import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** XML-escape text nodes/attributes per the XML spec. */
function xesc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /api/feed.xml - RSS 2.0 wire feed. Carries every transmit (event)
 * as an item so readers/IFTTT/Slack RSS can mirror the schedule. Item
 * links are ?event=slug deep links - feed readers land straight on the
 * RSVP dialog (upcoming) or full brief (past). Pair it with the
 * Signal.WIRE newsletter: one is pull, the other is push.
 */
export async function GET(req: Request) {
  try {
    const events = await db.event.findMany({
      orderBy: { startsAt: "desc" },
      take: 30,
    });

    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      req.headers.get("origin") ??
      "https://nexus-website-inky.vercel.app";
    const link = `${base}/#events`;
    /** per-item deep link: opens the site straight on that event's dialog */
    const eventLink = (slug: string) => `${base}/?event=${encodeURIComponent(slug)}`;
    const built = new Date().toUTCString();

    const items = events
      .map((e) => {
        const title = `${e.title}${e.featured ? " ★ FLAGSHIP" : ""}`;
        const when = e.startsAt.toLocaleString("en-GB", {
          timeZone: "Asia/Calcutta",
          dateStyle: "full",
          timeStyle: "short",
        });
        return [
          "    <item>",
          `      <title>${xesc(title)}</title>`,
          `      <link>${xesc(eventLink(e.slug))}</link>`,
          `      <guid isPermaLink="false">nexus-event-${xesc(e.id)}</guid>`,
          `      <category>${xesc(e.category)}</category>`,
          `      <pubDate>${e.startsAt.toUTCString()}</pubDate>`,
          `      <description>${xesc(`${e.description}\n\n📍 ${e.venue}\n🗓 ${when} IST`)}</description>`,
          "    </item>",
        ].join("\n");
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NEXUS WIRE - VIT Chennai</title>
    <link>${xesc(link)}</link>
    <description>The NEXUS transmit schedule as a wire feed. Innovate. Lead. Build.</description>
    <language>en-in</language>
    <lastBuildDate>${built}</lastBuildDate>
    <generator>NEXUS grid / prisma</generator>
    <atom:link href="${xesc(base)}/api/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/feed.xml failed:", err);
    return NextResponse.json({ error: "wire feed fault" }, { status: 500 });
  }
}
