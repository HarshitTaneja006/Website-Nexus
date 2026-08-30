import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminAuth } from "@/lib/admin-auth";

/**
 * PATCH /api/admin/join-requests
 * Headers: x-admin-key: <key> or Authorization: Bearer <key>
 * Body: { id: string, action: "approve" | "reject" | "reset" }
 *
 * Moves a join request through the review pipeline.
 * Requires admin authorization.
 */

export const dynamic = "force-dynamic";

const STATUSES: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  reset: "pending",
};

export async function PATCH(req: NextRequest) {
  const auth = verifyAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error || "ACCESS DENIED — invalid ops credentials" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";

  if (!id || id.length > 64) {
    return NextResponse.json(
      { error: "Invalid or missing 'id' parameter" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const status = STATUSES[action];
  if (!status) {
    return NextResponse.json(
      { error: "Invalid action. Expected one of: approve, reject, reset" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const updated = await db.joinRequest.update({
      where: { id },
      data: { status, reviewedAt: status === "pending" ? null : new Date() },
    });

    return NextResponse.json(
      {
        ok: true,
        request: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          branch: updated.branch,
          year: updated.year,
          interest: updated.interest,
          message: updated.message,
          status: updated.status,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err: unknown) {
    // Check if error is Prisma record not found (P2025)
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Join request not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    console.error("join-request review error:", err);
    return NextResponse.json(
      { error: "Internal error processing join request review" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
