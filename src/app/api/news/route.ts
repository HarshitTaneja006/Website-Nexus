import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string | null;
}

interface CacheEntry {
  items: NewsItem[];
  at: number;
}

// In-memory cache for live news uplink
let cache: CacheEntry | null = null;
const TTL = 10 * 60 * 1000; // 10 minutes

const FALLBACK_ITEMS: NewsItem[] = [
  {
    title: "Small models keep eating the agent stack — and budgets love it",
    url: "https://www.technologyreview.com/",
    source: "MIT TECH REVIEW",
    published: new Date().toISOString(),
  },
  {
    title: "Next.js 16 pushes partial prerendering into more default routes",
    url: "https://nextjs.org/blog",
    source: "NEXT.JS BLOG",
    published: new Date().toISOString(),
  },
  {
    title: "Post-quantum crypto lands in mainstream TLS stacks",
    url: "https://blog.cloudflare.com/",
    source: "CLOUDFLARE",
    published: new Date().toISOString(),
  },
  {
    title: "Open-source robotics kits hit 2x sales as campus labs expand",
    url: "https://news.ycombinator.com/",
    source: "HACKER NEWS",
    published: new Date().toISOString(),
  },
  {
    title: "WebAssembly System Interface (WASI) 0.2 officially released",
    url: "https://bytecodealliance.org/",
    source: "BYTECODE ALLIANCE",
    published: new Date().toISOString(),
  },
  {
    title: "State of Databases: Postgres continues dominance in modern cloud apps",
    url: "https://postgres.ai/",
    source: "POSTGRES AI",
    published: new Date().toISOString(),
  },
];

function extractSource(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host.includes("ycombinator.com")) return "HACKER NEWS";
    if (host.includes("github.com")) return "GITHUB";
    const parts = host.split(".");
    return parts[0].toUpperCase();
  } catch {
    return "WIRE";
  }
}

interface HNStoryResponse {
  id: number;
  deleted?: boolean;
  type?: string;
  by?: string;
  time?: number;
  dead?: boolean;
  url?: string;
  title?: string;
  score?: number;
}

async function fetchHackerNews(): Promise<NewsItem[]> {
  const topRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
    signal: AbortSignal.timeout(5000),
    headers: { "User-Agent": "Nexus-Tech-News/1.0" },
  });

  if (!topRes.ok) {
    throw new Error(`HN top stories returned status ${topRes.status}`);
  }

  const ids = (await topRes.json()) as number[];
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("No story IDs received from HN");
  }

  // Take top 20 candidate stories to fetch in parallel
  const candidateIds = ids.slice(0, 20);

  const storyPromises = candidateIds.map(async (id) => {
    try {
      const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "Nexus-Tech-News/1.0" },
      });
      if (!itemRes.ok) return null;
      return (await itemRes.json()) as HNStoryResponse;
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(storyPromises);
  const items: NewsItem[] = [];

  for (const res of results) {
    if (res.status !== "fulfilled" || !res.value) continue;
    const story = res.value;

    if (story.dead || story.deleted || !story.title) continue;

    const rawUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    let validUrl = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      validUrl = parsed.href;
    } catch {
      continue;
    }

    const title = story.title.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 180);
    if (!title || title.length < 5) continue;

    const source = story.url ? extractSource(story.url) : "HACKER NEWS";
    const published = story.time ? new Date(story.time * 1000).toISOString() : null;

    items.push({
      title,
      url: validUrl,
      source,
      published,
    });

    if (items.length >= 8) break;
  }

  return items;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ items: cache.items, cached: true, degraded: false });
  }

  try {
    const items = await fetchHackerNews();

    if (items.length === 0) {
      throw new Error("Empty items parsed from live uplink");
    }

    cache = { items, at: Date.now() };
    return NextResponse.json({ items, cached: false, degraded: false });
  } catch (err) {
    console.error("GET /api/news failed:", err);

    // Fall back to stale cache if available, else curated fallback items
    if (cache && cache.items.length > 0) {
      return NextResponse.json({
        items: cache.items,
        cached: true,
        degraded: true,
        error: "Serving stale uplink cache",
      });
    }

    return NextResponse.json({
      items: FALLBACK_ITEMS,
      cached: false,
      degraded: true,
      error: "Live uplink unavailable, serving fallback items",
    });
  }
}
