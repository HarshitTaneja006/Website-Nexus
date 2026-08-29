import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * GET /api/admin/stats?key=… (or x-admin-key header)
 * Restricted ops data for the NEXUS OPS CONSOLE: RSVP counts per event,
 * join requests, and the presence-service peak. Key-checked; the default
 * dev key is "nexus-admin" (override with ADMIN_KEY env).
 */

const DEFAULT_KEY = "nexus-admin";

function keyOk(provided: string | null): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(process.env.ADMIN_KEY || DEFAULT_KEY).digest();
  return timingSafeEqual(a, b);
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`;
}

async function presenceStats(): Promise<{ count: number | null; peak: number | null }> {
  try {
    const res = await fetch("http://localhost:3004/stats", {
      signal: AbortSignal.timeout(900),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { count?: number; peak?: number };
    return { count: data.count ?? null, peak: data.peak ?? null };
  } catch {
    return { count: null, peak: null };
  }
}

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("key");
  if (!keyOk(key)) {
    return NextResponse.json(
      { error: "ACCESS DENIED — invalid ops key" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const [events, joinTotal, joinRequests, presence] = await Promise.all([
      db.event.findMany({
        orderBy: { startsAt: "desc" },
        select: {
          slug: true,
          title: true,
          category: true,
          startsAt: true,
          featured: true,
          _count: { select: { rsvps: true } },
        },
      }),
      db.joinRequest.count(),
      db.joinRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { name: true, email: true, branch: true, year: true, interest: true, createdAt: true },
      }),
      presenceStats(),
    ]);

    const rsvpsByEvent = events.map((e) => ({
      slug: e.slug,
      title: e.title,
      category: e.category,
      startsAt: e.startsAt.toISOString(),
      featured: e.featured,
      count: e._count.rsvps,
    }));

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        totals: {
          rsvps: rsvpsByEvent.reduce((s, e) => s + e.count, 0),
          joinRequests: joinTotal,
          events: events.length,
          featuredEvent: events.find((e) => e.featured)?.title ?? null,
          presence: presence,
        },
        rsvpsByEvent,
        joinRequests: joinRequests.map((j) => ({
          name: j.name,
          email: maskEmail(j.email),
          branch: j.branch,
          year: j.year,
          interest: j.interest,
          createdAt: j.createdAt.toISOString(),
        })),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("admin/stats error:", err);
    return NextResponse.json({ error: "ops uplink failure" }, { status: 500 });
  }
}
