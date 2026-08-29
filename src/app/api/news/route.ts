import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

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

// simple in-memory cache (per the stack policy: local memory caching only)
let cache: CacheEntry | null = null;
const TTL = 30 * 60 * 1000; // 30 minutes

const QUERIES = [
  "AI model release announcement this week OpenAI Anthropic Google",
  "developer tools launch news this week",
  "tech industry breaking news",
];

function hostLabel(host: string): string {
  return host.replace(/^www\./, "").split(".")[0].toUpperCase();
}

/**
 * Reject low-quality search hits: site homepages, index/listing pages and
 * truncated titles that read like navigation crumbs instead of headlines.
 */
function isQualityHit(url: string, title: string): boolean {
  const t = title.trim().toLowerCase();
  // homepage / listing patterns
  const badPatterns = [
    /:\s*home$/, // "…: Home"
    /\|\s*(latest|home|news\s*$)/, // "X | Latest …" pipe-crumb titles
    /^(ai |tech )?(news|updates|analysis|reviews?)\b/, // titles that START with "News…" / "AI News…"
    /\b(latest|breaking)\b.*\b(news|analysis|updates)\b/, // "Latest AI News and Analysis"
    /\b(news|updates|products?|analysis|coverage|reviews?)\s*(and|&|,|\+)?\s*(products?|analysis|updates|reviews?)?\s*$/i,
    /^what\b|^how\b.*(website|newsletter)/, // Q&A/listicle search results
    /news,\s*trends\s*&/, // "X: Software Development News, Trends & Best…"
    /^\d{4}\b/, // bare year titles
    /\b(subscribe|sign in|log in|newsletter signup)\b/,
    /\bmagazine\b|\bjournal\b|\barchive\b|\btopics?\b$/,
  ];
  if (badPatterns.some((p) => p.test(t))) return false;
  // root URLs are homepages, not articles
  try {
    const { pathname } = new URL(url);
    if (pathname === "/" || pathname.length < 2) return false;
  } catch {
    return false; // unparseable URL
  }
  // headline must have some substance
  if (t.split(/\s+/).length < 5) return false;
  return true;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ items: cache.items, cached: true, degraded: false });
  }

  try {
    const zai = await ZAI.create();
    const seen = new Set<string>();
    const items: NewsItem[] = [];

    for (const q of QUERIES) {
      const results = (await zai.functions.invoke("web_search", {
        query: q,
        num: 8,
        recency_days: 10,
      })) as Array<{
        url: string;
        name: string;
        snippet?: string;
        host_name?: string;
        date?: string;
      }>;

      for (const r of results) {
        if (!r?.url || !r?.name || seen.has(r.url)) continue;
        if (!isQualityHit(r.url, r.name)) continue;
        seen.add(r.url);
        items.push({
          title: r.name.trim().slice(0, 160),
          url: r.url,
          source: r.host_name ? hostLabel(r.host_name) : "WIRE",
          published: r.date && !Number.isNaN(new Date(r.date).getTime()) ? r.date : null,
        });
      }
    }

    if (items.length === 0) throw new Error("empty feed");

    cache = { items: items.slice(0, 8), at: Date.now() };
    return NextResponse.json({ items: cache.items, cached: false, degraded: false });
  } catch (err) {
    console.error("GET /api/news failed:", err);
    return NextResponse.json(
      { items: [], cached: false, degraded: true, error: "uplink fault" },
      { status: 200 }
    );
  }
}
