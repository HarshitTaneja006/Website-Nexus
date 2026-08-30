import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Standard RFC 5322 compatible email regex
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * GET /api/rsvp-lookup?email=…
 * Self-service lookup: given an email, return the public event metadata that
 * this address has RSVP'd to. Only event metadata is returned (no PII or other attendee data).
 */
export async function GET(req: NextRequest) {
  const rawEmail = req.nextUrl.searchParams.get("email") || "";
  const email = rawEmail.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required (max 254 characters)" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const rsvps = await db.rsvp.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        createdAt: true,
        event: {
          select: {
            slug: true,
            title: true,
            category: true,
            venue: true,
            startsAt: true,
            featured: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        email,
        rsvps: rsvps.map((r) => ({
          slug: r.event.slug,
          title: r.event.title,
          category: r.event.category,
          venue: r.event.venue,
          startsAt: r.event.startsAt.toISOString(),
          featured: r.event.featured,
          rsvpAt: r.createdAt.toISOString(),
        })),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/rsvp-lookup failed:", err);
    return NextResponse.json(
      { error: "Failed to perform RSVP lookup" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
