import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/join-requests  (x-admin-key header or ?key=)
 * Body: { id: string, action: "approve" | "reject" | "reset" }
 *
 * Moves a join request through the review pipeline. Approving returns the
 * UNMASKED record so the OPS console can compose the welcome packet
 * client-side (the reviewer is already key-authenticated at this point).
 */

const DEFAULT_KEY = "nexus-admin";

function keyOk(provided: string | null): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(process.env.ADMIN_KEY || DEFAULT_KEY).digest();
  return timingSafeEqual(a, b);
}

const STATUSES: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  reset: "pending",
};

export async function PATCH(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("key");
  if (!keyOk(key)) {
    return NextResponse.json(
      { error: "ACCESS DENIED — invalid ops key" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  let body: { id?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const { id, action } = body;
  const status = action ? STATUSES[action] : undefined;
  if (!id || !status) {
    return NextResponse.json(
      { error: "expected { id, action: approve|reject|reset }" },
      { status: 400 }
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
  } catch (err) {
    // unknown id → Prisma P2025; anything else is a real fault
    console.error("join-request review error:", err);
    return NextResponse.json({ error: "join request not found or fault" }, { status: 500 });
  }
}
