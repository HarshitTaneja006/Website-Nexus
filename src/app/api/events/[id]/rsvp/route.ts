import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Standard RFC 5322 compatible email regex
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const eventId = typeof rawId === "string" ? rawId.trim() : "";

    if (!eventId || eventId.length > 64) {
      return NextResponse.json(
        { error: "Invalid event identifier" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    let body: { name?: unknown; email?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const rawName = typeof body?.name === "string" ? body.name : "";
    const rawEmail = typeof body?.email === "string" ? body.email : "";

    // Sanitize control characters and normalize
    const name = rawName.replace(/[\x00-\x1F\x7F]/g, "").trim();
    const email = rawEmail.trim().toLowerCase();

    if (!name || name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Name must be between 2 and 80 characters" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required (max 254 characters)" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Lookup event by ID (or fallback to slug if identifier matches slug)
    const event = await db.event.findFirst({
      where: {
        OR: [{ id: eventId }, { slug: eventId }],
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    await db.rsvp.upsert({
      where: { eventId_email: { eventId: event.id, email } },
      update: { name },
      create: { eventId: event.id, email, name },
    });

    const rsvpCount = await db.rsvp.count({ where: { eventId: event.id } });
    return NextResponse.json(
      { ok: true, rsvpCount },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /api/events/[id]/rsvp failed:", err);
    return NextResponse.json(
      { error: "Failed to process RSVP request" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
