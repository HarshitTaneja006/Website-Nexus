"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Rss } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useReveal } from "@/components/site/use-reveal";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string | null;
}

const FALLBACK: NewsItem[] = [
  {
    title: "Small models keep eating the agent stack - and budgets love it",
    url: "https://www.technologyreview.com/",
    source: "MIT Tech Review",
    published: null,
  },
  {
    title: "Next.js 16 pushes partial prerendering into more default routes",
    url: "https://nextjs.org/blog",
    source: "Next.js Blog",
    published: null,
  },
  {
    title: "Post-quantum crypto lands in mainstream TLS stacks",
    url: "https://blog.cloudflare.com/",
    source: "Cloudflare",
    published: null,
  },
  {
    title: "Open-source robotics kits hit 2x sales as campus labs expand",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    published: null,
  },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function safeExternalUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // fallback
  }
  return "#news";
}

export function TechNews() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [spin, setSpin] = useState(false);
  const { ref, seen } = useReveal<HTMLDivElement>();

  const load = async () => {
    setSpin(true);
    try {
      const r = await fetch("/api/news");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "uplink fault");
      const fetchedItems = Array.isArray(data?.items) ? (data.items as NewsItem[]) : [];
      if (fetchedItems.length === 0) {
        setItems(FALLBACK);
        setDegraded(true);
      } else {
        setItems(fetchedItems);
        setDegraded(Boolean(data.degraded));
      }
    } catch {
      setItems(FALLBACK);
      setDegraded(true);
    } finally {
      setSpin(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section id="news" className="relative border-b border-border/60 bg-[#070b14]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-primary">04 / NEWS UPLINK</p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Signal from the outside
              </h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className={`led ${degraded ? "led-amber" : ""}`} />
              <span>{degraded ? "CACHE FEED" : "LIVE UPLINK"}</span>
              <a
                href="/api/feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                title="subscribe to the wire - RSS"
                aria-label="RSS wire feed"
                className="grid h-8 w-8 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-amber-300/50 hover:text-amber-300"
              >
                <Rss className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={load}
                className="grid h-8 w-8 place-items-center rounded-sm border border-border transition-colors hover:border-primary/50 hover:text-primary"
                aria-label="Refresh news"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {items === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-md border border-border bg-card p-4">
                    <Skeleton className="h-3 w-28 bg-secondary" />
                    <Skeleton className="mt-3 h-5 w-5/6 bg-secondary" />
                    <Skeleton className="mt-2 h-3 w-20 bg-secondary" />
                  </div>
                ))
              : items.slice(0, 6).map((n, i) => (
                  <a
                    key={`${n.url}-${i}`}
                    href={safeExternalUrl(n.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex flex-col overflow-hidden rounded-md border border-border bg-card p-4 pl-5 transition-all duration-300 hover:border-primary/40 hover:bg-secondary/30 hover:shadow-[0_0_24px_rgba(96,165,250,0.07)]"
                  >
                    {/* left accent rail - lights up on hover */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-primary/0 via-primary/60 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-primary/40">{String(i + 1).padStart(2, "0")}</span>
                        <span className="rounded-sm border border-primary/20 bg-primary/5 px-1.5 py-px text-primary/80 transition-colors group-hover:border-primary/40">
                          {n.source || "WIRE"}
                        </span>
                      </span>
                      <span className="tabular-nums">{timeAgo(n.published)}</span>
                    </div>
                    <p className="mt-2 flex-1 text-sm font-medium leading-snug text-foreground/90 transition-colors group-hover:text-primary">
                      {n.title}
                    </p>
                    <span className="mt-3 flex items-center gap-1 font-mono text-[9px] tracking-[0.15em] text-muted-foreground/70 transition-colors group-hover:text-primary/90">
                      READ WIRE
                      <ExternalLink className="h-3 w-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </a>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
