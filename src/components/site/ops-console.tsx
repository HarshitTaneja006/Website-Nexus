"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, Lock, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * OpsConsole — restricted shell for the core team, opened from the ⌘K
 * palette ("OPS CONSOLE") or via the `nexus:ops` CustomEvent.
 * Key-gated stats: RSVP counts, join requests, presence peak.
 */

interface Stats {
  generatedAt: string;
  totals: {
    rsvps: number;
    joinRequests: number;
    events: number;
    featuredEvent: string | null;
    presence: { count: number | null; peak: number | null };
  };
  rsvpsByEvent: { slug: string; title: string; category: string; startsAt: string; featured: boolean; count: number }[];
  joinRequests: { name: string; email: string; branch: string; year: string; interest: string; createdAt: string }[];
}

export const OPS_EVENT = "nexus:ops";

export function OpsConsole() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPS_EVENT, onOpen);
    return () => window.removeEventListener(OPS_EVENT, onOpen);
  }, []);

  const auth = useCallback(
    async (k: string) => {
      if (!k.trim() || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/stats?key=${encodeURIComponent(k.trim())}`, { cache: "no-store" });
        if (res.status === 401) {
          setError("ACCESS DENIED — wrong key");
          setStats(null);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setStats((await res.json()) as Stats);
        toast({ title: "OPS UPLINK LIVE", description: "restricted shell unlocked" });
      } catch {
        setError("UPLINK FAILURE — try again");
      } finally {
        setLoading(false);
      }
    },
    [loading, toast]
  );

  const refresh = useCallback(() => auth(key), [auth, key]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="thin-scroll max-h-[85vh] overflow-y-auto border-primary/25 bg-[#070c08] p-0 font-mono sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 bg-secondary/40 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm tracking-[0.25em] text-primary">
            <Lock className="h-3.5 w-3.5" />
            NEXUS//OPS — RESTRICTED SHELL
          </DialogTitle>
          <DialogDescription className="text-[10px] tracking-widest text-muted-foreground">
            rsvp ledger · join feed · presence peak
          </DialogDescription>
        </DialogHeader>

        {!stats ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              auth(key);
            }}
            className="px-5 py-6"
          >
            <label htmlFor="ops-key" className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 text-primary/70" />
              ENTER OPS KEY
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="ops-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                placeholder="********"
                className="h-9 flex-1 rounded-sm border border-input bg-background px-3 text-xs tracking-[0.3em] text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="submit" size="sm" disabled={loading} className="font-mono text-[11px] tracking-widest">
                {loading ? "LINKING…" : "AUTH"}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-[10px] tracking-widest text-destructive" role="alert">
                {error}
              </p>
            )}
            <p className="mt-4 text-[9px] leading-relaxed tracking-wider text-muted-foreground/60">
              default dev key: <span className="text-amber-300/80">nexus-admin</span> · override with the
              ADMIN_KEY environment variable. keys are compared constant-time, emails masked.
            </p>
          </form>
        ) : (
          <div className="px-5 py-4">
            {/* stat tiles */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "RSVPS", value: stats.totals.rsvps },
                { label: "JOINS", value: stats.totals.joinRequests },
                { label: "EVENTS", value: stats.totals.events },
                {
                  label: "PEAK GRID",
                  value: stats.totals.presence.peak == null ? "—" : stats.totals.presence.peak,
                },
              ].map((t) => (
                <div key={t.label} className="hud-corners border border-border/70 bg-secondary/30 px-3 py-2.5">
                  <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{t.label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-primary text-glow">{t.value}</p>
                </div>
              ))}
            </div>

            {/* rsvp ledger */}
            <div className="mt-5">
              <p className="flex items-center justify-between text-[10px] tracking-[0.25em] text-muted-foreground">
                <span>RSVP LEDGER / PER EVENT</span>
                <button
                  onClick={refresh}
                  className="flex items-center gap-1 text-primary/70 transition-colors hover:text-primary"
                  aria-label="Refresh stats"
                >
                  <RefreshCcw className="h-3 w-3" />
                  SYNC
                </button>
              </p>
              <ul className="thin-scroll mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                {stats.rsvpsByEvent.map((e) => (
                  <li
                    key={e.slug}
                    className="flex items-center gap-2 border-b border-border/40 py-1.5 text-[10px] tracking-wider"
                  >
                    {e.featured && <span className="led led-amber shrink-0" title="flagship" />}
                    <span className="truncate text-foreground">{e.title}</span>
                    <span className="shrink-0 text-muted-foreground/60">{e.category}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-primary">{e.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* join feed */}
            <div className="mt-5">
              <p className="text-[10px] tracking-[0.25em] text-muted-foreground">JOIN FEED / LATEST {stats.joinRequests.length}</p>
              {stats.joinRequests.length === 0 ? (
                <p className="mt-2 border border-dashed border-border/60 px-3 py-4 text-center text-[10px] tracking-widest text-muted-foreground/60">
                  inbox empty — share the JOIN form link
                </p>
              ) : (
                <ul className="thin-scroll mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {stats.joinRequests.map((j, i) => (
                    <li key={`${j.email}-${i}`} className="border border-border/50 bg-background/50 px-3 py-2 text-[10px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold tracking-wider text-foreground">{j.name}</span>
                        <span className="tabular-nums text-muted-foreground/60">
                          {new Date(j.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Calcutta" })}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                        <span>{j.email}</span>
                        <span>{j.branch} · Y{Number.isNaN(Number(j.year)) ? j.year : j.year}</span>
                        <span className="text-primary/70">{j.interest}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-[9px] tracking-widest text-muted-foreground/60">
              <span>SESSION LOGGED · DO NOT SCREENSHOT</span>
              <span className="tabular-nums">{new Date(stats.generatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Calcutta" })} IST</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
