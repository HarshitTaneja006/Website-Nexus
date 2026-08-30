import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await db.event.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { rsvps: true } },
      },
    });

    return NextResponse.json(
      {
        events: events.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          description: e.description,
          category: e.category,
          venue: e.venue,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt ? e.endsAt.toISOString() : null,
          tags: e.tags,
          featured: e.featured,
          schedule: e.schedule,
          rsvpCount: e._count.rsvps,
        })),
      },
      {
        headers: {
          "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/events failed:", err);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
