import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Standard RFC 5322 compatible email regex
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * POST /api/newsletter { email }
 * Signal.Wire subscription — idempotent (email unique).
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const rawEmail = typeof body?.email === "string" ? body.email : "";
  const email = rawEmail.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required (max 254 characters)" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing) {
      const total = await db.subscriber.count();
      return NextResponse.json(
        { ok: true, already: true, total },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const [created, total] = await Promise.all([
      db.subscriber.create({ data: { email, source: "footer" } }),
      db.subscriber.count(),
    ]);

    return NextResponse.json(
      { ok: true, already: false, total, id: created.id },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /api/newsletter failed:", err);
    return NextResponse.json(
      { error: "Failed to process newsletter subscription" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/newsletter?email=…
 * One-click opt-out.
 */
export async function DELETE(req: NextRequest) {
  const rawEmail = req.nextUrl.searchParams.get("email") || "";
  const email = rawEmail.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const deleted = await db.subscriber.deleteMany({ where: { email } });
    const total = await db.subscriber.count();
    return NextResponse.json(
      {
        ok: true,
        removed: deleted.count > 0,
        total,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("DELETE /api/newsletter failed:", err);
    return NextResponse.json(
      { error: "Failed to process newsletter opt-out" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
