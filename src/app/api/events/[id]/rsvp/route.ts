import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "email does not parse" }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: "event not found" }, { status: 404 });
    }

    await db.rsvp.upsert({
      where: { eventId_email: { eventId: id, email } },
      update: { name },
      create: { eventId: id, email, name },
    });

    const rsvpCount = await db.rsvp.count({ where: { eventId: id } });
    return NextResponse.json({ ok: true, rsvpCount });
  } catch (err) {
    console.error("POST /api/events/[id]/rsvp failed:", err);
    return NextResponse.json({ error: "rsvp fault" }, { status: 500 });
  }
}
