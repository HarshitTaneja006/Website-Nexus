import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/rsvp-lookup?email=…
 * Self-service lookup: given an email, return the events that address has
 * RSVP'd to. Only event metadata is returned (no PII beyond the email
 * the caller already knows) — designed for the MY.RSVP panel.
 */

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "VALID EMAIL REQUIRED" }, { status: 400 });
  }

  try {
    const rsvps = await db.rsvp.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
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
    return NextResponse.json({ error: "lookup uplink failure" }, { status: 500 });
  }
}
