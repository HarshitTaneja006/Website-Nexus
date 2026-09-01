"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BadgeCheck, ChevronDown, Copy, KeyRound, Lock, Radio, RefreshCcw, ThumbsDown, XCircle } from "lucide-react";
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
    subscribers: number;
    featuredEvent: string | null;
    presence: { count: number | null; peak: number | null };
  };
  rsvpsByEvent: {
    slug: string;
    title: string;
    category: string;
    startsAt: string;
    featured: boolean;
    count: number;
    attendees: { name: string; email: string; at: string }[];
  }[];
  subscribers: { email: string; source: string; at: string }[];
  joinRequests: {
    id: string;
    name: string;
    email: string;
    branch: string;
    year: string;
    interest: string;
    status: string;
    createdAt: string;
  }[];
  joinStatus: { pending: number; approved: number; rejected: number };
}

/** unmasked records returned by approve — keyed for the welcome packet */
type Unmasked = { id: string; name: string; email: string; branch: string; year: string; interest: string };

export const OPS_EVENT = "nexus:ops";

export function OpsConsole() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [joinFilter, setJoinFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [busyJoin, setBusyJoin] = useState<string | null>(null);
  const welcomeCache = useRef<Map<string, Unmasked>>(new Map());

  const toggle = useCallback((slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

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
        const res = await fetch("/api/admin/stats", {
          headers: {
            "x-admin-key": k.trim(),
          },
          cache: "no-store",
        });
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

  /** next upcoming transmit (flagship first) for the welcome packet */
  const nextTransmit = useCallback((): { title: string; when: string } | null => {
    if (!stats) return null;
    const now = Date.now();
    const upcoming = stats.rsvpsByEvent
      .filter((e) => new Date(e.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const pick = upcoming.find((e) => e.featured) ?? upcoming[0];
    if (!pick) return null;
    const when = new Date(pick.startsAt).toLocaleString("en-GB", {
      timeZone: "Asia/Calcutta",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { title: pick.title, when: `${when} IST` };
  }, [stats]);

  const welcomePacket = useCallback(
    (rec: Unmasked): string => {
      const next = nextTransmit();
      const reviewed = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Calcutta" });
      return [
        "────────── NEXUS//WELCOME ──────────",
        `to: ${rec.email}`,
        "",
        `Hi ${rec.name},`,
        "",
        `Your join request (${rec.interest} · ${rec.branch} Y${rec.year}) was APPROVED on ${reviewed}.`,
        "Welcome to the collective — VIT Chennai's student tech grid.",
        "",
        "NEXT STEPS",
        "1. RSVP to what looks fun  → #events on the site",
        "2. Pick a build crew: ai/ml · web · cloud/devops · open source · mobile",
        "3. Watch the wire for transmits (RSS in the footer)",
        ...(next ? ["", `FLAGSHIP INCOMING: ${next.title} — ${next.when}`] : []),
        "",
        "Innovate. Lead. Build.",
        "— NEXUS core team · nexusvitc@gmail.com",
        "────────────────────────────────────",
      ].join("\n");
    },
    [nextTransmit]
  );

  const copyWelcome = useCallback(
    (id: string) => {
      const rec = welcomeCache.current.get(id);
      if (!rec) {
        toast({
          title: "NO UNMASKED RECORD",
          description: "re-approve the request to load the welcome packet",
          variant: "destructive",
        });
        return;
      }
      const text = welcomePacket(rec);
      // async clipboard first; execCommand fallback for hardened contexts
      const legacyCopy = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      };
      const done = () =>
        toast({ title: "WELCOME COPIED", description: `${rec.name} · ${rec.email} — paste into the mail client` });
      const blocked = () => toast({ title: "CLIPBOARD BLOCKED", variant: "destructive" });
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(done).catch(() => (legacyCopy() ? done() : blocked()));
      } else if (legacyCopy()) {
        done();
      } else {
        blocked();
      }
    },
    [toast, welcomePacket]
  );

  const reviewJoin = useCallback(
    async (id: string, action: "approve" | "reject" | "reset") => {
      if (busyJoin) return;
      setBusyJoin(id);
      try {
        const res = await fetch("/api/admin/join-requests", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-admin-key": key.trim() },
          body: JSON.stringify({ id, action }),
        });
        if (res.status === 401) {
          toast({ title: "ACCESS DENIED", description: "ops key rejected", variant: "destructive" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { request: Unmasked & { status: string } };
        // cache the unmasked record that approve returns — the welcome
        // packet needs the real address
        if (action === "approve") {
          welcomeCache.current.set(id, data.request);
        }
        // optimistic local patch — no full re-sync needed
        setStats((prev) =>
          prev
            ? {
                ...prev,
                joinRequests: prev.joinRequests.map((j) =>
                  j.id === id ? { ...j, status: data.request.status } : j
                ),
                joinStatus: {
                  pending: prev.joinRequests.filter((j) => (j.id === id ? action === "reset" : j.status === "pending")).length,
                  approved: prev.joinRequests.filter((j) => (j.id === id ? action === "approve" : j.status === "approved")).length,
                  rejected: prev.joinRequests.filter((j) => (j.id === id ? action === "reject" : j.status === "rejected")).length,
                },
              }
            : prev
        );
        toast({
          title:
            action === "approve" ? "RECRUIT APPROVED ✓" : action === "reject" ? "REQUEST REJECTED" : "MOVED BACK TO PENDING",
          description:
            action === "approve"
              ? `${data.request.name} — copy the welcome packet and hit send`
              : `${data.request.name}`,
        });
      } catch {
        toast({ title: "REVIEW FAULT", description: "could not reach the join ledger", variant: "destructive" });
      } finally {
        setBusyJoin(null);
      }
    },
    [busyJoin, key, toast]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="thin-scroll max-h-[85vh] overflow-y-auto border-primary/25 bg-[#070c15] p-0 font-mono sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 bg-secondary/40 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm tracking-[0.25em] text-primary">
            <Lock className="h-3.5 w-3.5" />
            NEXUS//OPS — RESTRICTED SHELL
          </DialogTitle>
          <DialogDescription className="text-[10px] tracking-widest text-muted-foreground">
            rsvp ledger · attendee names · join review + welcome packets · wire subscribers · presence peak
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "RSVPS", value: stats.totals.rsvps },
                { label: "JOINS", value: stats.totals.joinRequests },
                { label: "EVENTS", value: stats.totals.events },
                { label: "WIRE SUBS", value: stats.totals.subscribers },
                {
                  label: "PEAK GRID",
                  value: stats.totals.presence.peak == null ? "—" : stats.totals.presence.peak,
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="hud-corners border border-border/70 bg-secondary/30 px-3 py-2.5 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_16px_rgba(96,165,250,0.08)]"
                >
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
              <ul className="thin-scroll mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                {stats.rsvpsByEvent.map((e) => {
                  const isOpen = expanded.has(e.slug);
                  return (
                    <li key={e.slug} className="border-b border-border/40 py-1 text-[10px] tracking-wider">
                      <button
                        onClick={() => toggle(e.slug)}
                        aria-expanded={isOpen}
                        disabled={e.count === 0}
                        className="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:hover:bg-transparent"
                        title={e.count === 0 ? "no rsvps yet" : "show/hide ledger"}
                      >
                        {e.featured && <span className="led led-amber shrink-0" title="flagship" />}
                        <span className="truncate text-foreground">{e.title}</span>
                        <span className="shrink-0 text-muted-foreground/60">{e.category}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-primary">{e.count}</span>
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          } ${e.count === 0 ? "opacity-0" : ""}`}
                        />
                      </button>
                      {isOpen && e.attendees.length > 0 && (
                        <ul className="mb-1.5 ml-4 space-y-0.5 border-l border-primary/20 pl-3 pt-1">
                          {e.attendees.map((a, i) => (
                            <li key={`${a.email}-${i}`} className="flex items-center justify-between gap-2 text-[9px]">
                              <span className="truncate font-bold tracking-wider text-foreground/90">{a.name}</span>
                              <span className="flex shrink-0 items-center gap-2 text-muted-foreground/70">
                                <span className="hidden sm:inline">{a.email}</span>
                                <span className="tabular-nums">
                                  {new Date(a.at).toLocaleDateString("en-GB", { timeZone: "Asia/Calcutta" })}
                                </span>
                              </span>
                            </li>
                          ))}
                          {e.count > e.attendees.length && (
                            <li className="pt-0.5 text-[9px] text-muted-foreground/50">
                              +{e.count - e.attendees.length} more…
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* wire subscribers */}
            <div className="mt-5">
              <p className="flex items-center justify-between text-[10px] tracking-[0.25em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="led" aria-hidden="true" />
                  SIGNAL.WIRE / LATEST {stats.subscribers.length}
                </span>
                <span className="tabular-nums text-primary/70">{stats.totals.subscribers} TOTAL</span>
              </p>
              {stats.subscribers.length === 0 ? (
                <p className="mt-2 border border-dashed border-border/60 px-3 py-4 text-center text-[10px] tracking-widest text-muted-foreground/60">
                  wire silent — drop the footer signup link
                </p>
              ) : (
                <ul className="thin-scroll mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                  {stats.subscribers.map((s, i) => (
                    <li
                      key={`${s.email}-${i}`}
                      className="ledger-row flex items-center justify-between gap-2 border border-border/50 bg-background/50 px-3 py-1.5 text-[10px]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Radio className="h-3 w-3 shrink-0 text-primary/60" aria-hidden="true" />
                        <span className="truncate tracking-wider text-foreground/85">{s.email}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-muted-foreground/60">
                        <span className="rounded-sm bg-secondary/60 px-1.5 py-0.5 text-[9px] tracking-widest">
                          {s.source.toUpperCase()}
                        </span>
                        <span className="tabular-nums">
                          {new Date(s.at).toLocaleDateString("en-GB", { timeZone: "Asia/Calcutta" })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* join feed */}
            <div className="mt-5">
              <p className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.25em] text-muted-foreground">
                <span>JOIN FEED / LATEST {stats.joinRequests.length}</span>
                <span className="ml-auto flex items-center gap-1">
                  {(["all", "pending", "approved", "rejected"] as const).map((f) => {
                    const count =
                      f === "all" ? stats.joinRequests.length : stats.joinStatus[f];
                    return (
                      <button
                        key={f}
                        onClick={() => setJoinFilter(f)}
                        aria-pressed={joinFilter === f}
                        className={`rounded-sm border px-1.5 py-0.5 text-[9px] tracking-widest transition-colors ${
                          joinFilter === f
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground/70 hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {f.toUpperCase()} {count}
                      </button>
                    );
                  })}
                </span>
              </p>
              {(() => {
                const shown = stats.joinRequests.filter(
                  (j) => joinFilter === "all" || j.status === joinFilter
                );
                if (stats.joinRequests.length === 0) {
                  return (
                    <p className="mt-2 border border-dashed border-border/60 px-3 py-4 text-center text-[10px] tracking-widest text-muted-foreground/60">
                      inbox empty — share the JOIN form link
                    </p>
                  );
                }
                if (shown.length === 0) {
                  return (
                    <p className="mt-2 border border-dashed border-border/60 px-3 py-4 text-center text-[10px] tracking-widest text-muted-foreground/60">
                      no {joinFilter} requests in the latest 40
                    </p>
                  );
                }
                return (
                  <ul className="thin-scroll mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {shown.map((j, i) => (
                      <li
                        key={`${j.email}-${i}`}
                        className="ledger-row border border-border/50 bg-background/50 px-3 py-2 text-[10px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-bold tracking-wider text-foreground">{j.name}</span>
                            <span
                              className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[8px] tracking-[0.2em] ${
                                j.status === "approved"
                                  ? "bg-primary/15 text-primary"
                                  : j.status === "rejected"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-amber-400/10 text-amber-300/90"
                              }`}
                            >
                              {j.status === "approved" ? (
                                <span className="flex items-center gap-1"><BadgeCheck className="h-2.5 w-2.5" />APPROVED</span>
                              ) : j.status === "rejected" ? (
                                <span className="flex items-center gap-1"><XCircle className="h-2.5 w-2.5" />REJECTED</span>
                              ) : (
                                "● PENDING"
                              )}
                            </span>
                          </span>
                          <span className="tabular-nums text-muted-foreground/60">
                            {new Date(j.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Calcutta" })}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                          <span>{j.email}</span>
                          <span>{j.branch} · Y{Number.isNaN(Number(j.year)) ? j.year : j.year}</span>
                          <span className="text-primary/70">{j.interest}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {j.status === "pending" && (
                            <>
                              <button
                                onClick={() => reviewJoin(j.id, "approve")}
                                disabled={busyJoin === j.id}
                                className="flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] tracking-widest text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(96,165,250,0.25)] disabled:opacity-50"
                              >
                                <BadgeCheck className="h-3 w-3" />
                                {busyJoin === j.id ? "…" : "APPROVE"}
                              </button>
                              <button
                                onClick={() => reviewJoin(j.id, "reject")}
                                disabled={busyJoin === j.id}
                                className="flex items-center gap-1 rounded-sm border border-border/70 px-2 py-0.5 text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                              >
                                <ThumbsDown className="h-3 w-3" />
                                REJECT
                              </button>
                            </>
                          )}
                          {j.status === "approved" && (
                            <>
                              <button
                                onClick={() => copyWelcome(j.id)}
                                className="flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] tracking-widest text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(96,165,250,0.25)]"
                                title="copy the welcome packet to the clipboard"
                              >
                                <Copy className="h-3 w-3" />
                                COPY WELCOME
                              </button>
                              <button
                                onClick={() => reviewJoin(j.id, "reset")}
                                disabled={busyJoin === j.id}
                                className="rounded-sm border border-transparent px-1.5 py-0.5 text-[9px] tracking-widest text-muted-foreground/50 transition-colors hover:text-muted-foreground disabled:opacity-50"
                              >
                                undo
                              </button>
                            </>
                          )}
                          {j.status === "rejected" && (
                            <button
                              onClick={() => reviewJoin(j.id, "reset")}
                              disabled={busyJoin === j.id}
                              className="rounded-sm border border-border/60 px-2 py-0.5 text-[9px] tracking-widest text-muted-foreground/70 transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                            >
                              MOVE BACK TO PENDING
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
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
