import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/newsletter { email }
 * Signal.Wire subscription — idempotent (email unique), returns the wire
 * total so the footer can flash a live count.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "MALFORMED PAYLOAD" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
    return NextResponse.json({ error: "VALID EMAIL REQUIRED" }, { status: 400 });
  }

  try {
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing) {
      const total = await db.subscriber.count();
      return NextResponse.json({ ok: true, already: true, total });
    }
    const [created, total] = await Promise.all([
      db.subscriber.create({ data: { email } }),
      db.subscriber.count(),
    ]);
    return NextResponse.json({ ok: true, already: false, total, id: created.id });
  } catch (err) {
    console.error("POST /api/newsletter failed:", err);
    return NextResponse.json({ error: "WIRE FAULT — try again" }, { status: 500 });
  }
}
