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
  "site:techcrunch.com AI startup funding",
  "site:reuters.com technology AI",
  "site:arstechnica.com AI security",
  "site:theverge.com tech",
  "site:cnbc.com technology AI",
  "site:technologyreview.com AI",
];

/**
 * items older than this are stale for a "live uplink" — drop them.
 * (search backend's recency_days is advisory at best; enforce client-side)
 */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * docs / wiki / Q&A / social hosts — never news. Suffix entries match host
 * endings; prefix entries ("docs.") match host beginnings. Undated results
 * from these are dropped; dated articles from reputable orgs still pass.
 */
const DOMAIN_SUFFIXES = [
  "stackoverflow.com",
  "stackexchange.com",
  "developer.mozilla.org",
  "developer.chrome.com",
  "wikipedia.org",
  "github.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "linkedin.com",
  "medium.com",
  "quora.com",
  "w3.org",
];
const DOMAIN_PREFIXES = ["support.", "docs.", "en.", "developer."];

/**
 * undated results are only kept from real news outlets — a wire section
 * linking to random evergreen pages reads broken; a section front from
 * Reuters/TechCrunch at least reads like a wire.
 */
const NEWS_DOMAIN_WHITELIST = [
  "reuters.com",
  "techcrunch.com",
  "theverge.com",
  "arstechnica.com",
  "wired.com",
  "cnbc.com",
  "bloomberg.com",
  "geekwire.com",
  "venturebeat.com",
  "technologyreview.com",
  "news.mit.edu",
  "sciencedaily.com",
  "engadget.com",
  "thenextweb.com",
  "techradar.com",
  "news.ycombinator.com",
  "theinformation.com",
  "semianalysis.com",
  "simonwillison.net",
];

function hostLabel(host: string): string {
  return host.replace(/^www\./, "").split(".")[0].toUpperCase();
}

/**
 * Reject low-quality search hits: site homepages, index/listing pages,
 * tracker aggregators, docs changelogs and truncated titles that read like
 * navigation crumbs instead of headlines.
 */
function isQualityHit(url: string, title: string): boolean {
  const t = title.trim().toLowerCase();
  // homepage / listing / aggregator patterns
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
    // round-2 additions (observed leaks)
    /\btracker\b/, // "AI Model Release Tracker" — aggregator, not a story
    /\bnews\s+from\b/, // "Development and Programming News from ADTmag"
    /^(release notes|changelog|docs|documentation)\b/, // "Release notes | Chrome DevTools"
    /^\s*[-–—|·]\s*/, // titles that are basically a crumb separator
    /\b(rss|feed|sitemap|categories|tags|authors?)\b$/, // nav crumbs
    /\bjobs?\b|\bcareers?\b|\bhiring\b(?!\s+news)/, // job boards
    // round-3 additions (observed leaks)
    /^(list of|top \d+|best \d*)\b/, // listicles / roundup pages
    /\b(today's latest|latest stories|latest news)\b/, // "X News | Today's Latest Stories"
    /^(our mission|about(\s+us)?)\b/, // company about/mission pages
    /^\w+(\s+\w+){0,3}\s+news\s*\|/, // "OpenAI News | …" section listings
    /\b(sign up|log in)\b/, // auth walls
  ];
  if (badPatterns.some((p) => p.test(t))) return false;
  // root URLs are homepages, not articles
  try {
    const { pathname } = new URL(url);
    if (pathname === "/" || pathname.length < 2) return false;
  } catch {
    return false; // unparseable URL
  }
  // headline must have some substance (ignore "|" pipe separators when counting)
  const words = t.split(/\s+/).filter((w) => w !== "|");
  if (words.length < 5) return false;
  return true;
}

/** drop stale items — a live uplink should not surface "206d ago" */
function ageMs(published: string | null): number | null {
  if (!published) return null;
  const ts = new Date(published).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts;
}

function isNewsOutlet(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return NEWS_DOMAIN_WHITELIST.some((d) => host === d || host.endsWith(`.${d}`) || host === d);
  } catch {
    return false;
  }
}

/** undated pages only survive from real outlets that aren't docs/support hosts */
function isVettedUndated(url: string): boolean {
  if (!isNewsOutlet(url)) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (DOMAIN_PREFIXES.some((d) => host.startsWith(d))) return false;
    if (DOMAIN_SUFFIXES.some((d) => host.endsWith(d))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ items: cache.items, cached: true, degraded: false });
  }

  try {
    const zai = await ZAI.create();
    const seen = new Set<string>();
    const dated: NewsItem[] = [];
    const undated: NewsItem[] = [];

    for (const q of QUERIES) {
      let results: Array<{
        url: string;
        name: string;
        snippet?: string;
        host_name?: string;
        date?: string;
      }> = [];
      try {
        results = (await zai.functions.invoke("web_search", {
          query: q,
          num: 8,
          recency_days: 10,
        })) as typeof results;
      } catch {
        continue; // one failed query shouldn't kill the feed
      }

      for (const r of results) {
        if (!r?.url || !r?.name || seen.has(r.url)) continue;
        if (!isQualityHit(r.url, r.name)) continue;
        const published =
          r.date && !Number.isNaN(new Date(r.date).getTime()) ? r.date : null;
        const age = ageMs(published);
        if (age != null && age > MAX_AGE_MS) continue; // stale article
        seen.add(r.url);
        const item: NewsItem = {
          title: r.name.trim().slice(0, 160),
          url: r.url,
          source: r.host_name ? hostLabel(r.host_name) : "WIRE",
          published,
        };
        if (published) {
          dated.push(item);
        } else if (isVettedUndated(r.url)) {
          undated.push(item); // wire-front pages from real outlets = last resort
        }
      }
    }

    // freshest first; dated items rank above undated ones
    dated.sort((a, b) => {
      const ta = a.published ? new Date(a.published).getTime() : 0;
      const tb = b.published ? new Date(b.published).getTime() : 0;
      return tb - ta;
    });

    // prefer real dated articles; top up with vetted undated pages only if thin
    const items = dated.length >= 4 ? dated : [...dated, ...undated];
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
