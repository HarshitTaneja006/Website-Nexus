import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVCalendar } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar.ics - subscribable RFC 5545 calendar of the whole
 * transmit schedule. Point Google Calendar / Apple Calendar / any client
 * at this URL and every NEXUS event lands on the grid.
 */
export async function GET(req: Request) {
  try {
    const events = await db.event.findMany({
      orderBy: { startsAt: "asc" },
    });

    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      req.headers.get("origin") ??
      "https://nexus-website-inky.vercel.app";

    const body = buildVCalendar(
      events.map((e) => ({
        uid: e.id,
        title: `${e.title}${e.featured ? " ★" : ""}`,
        description: e.description,
        venue: e.venue,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt ? e.endsAt.toISOString() : null,
        url: `${base}/#events`,
      })),
      {
        name: "NEXUS - VIT Chennai · Transmit Schedule",
        description:
          "Every NEXUS event on one feed. Subscribe once, never miss a transmit.",
      }
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="nexus-transmit-schedule.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/calendar.ics failed:", err);
    return NextResponse.json({ error: "calendar feed fault" }, { status: 500 });
  }
}
