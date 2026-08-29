"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarPlus, CalendarRange, Link2, ListOrdered, MapPin, Rss, ScanLine, Share2, Timer, Users } from "lucide-react";
import { AsciiBanner } from "@/components/ascii/ascii-banner";
import { AsciiImage, AsciiThumb } from "@/components/ascii/ascii-image";
import { AsciiLightbox, type LightboxShot } from "@/components/ascii/ascii-lightbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useReveal } from "@/components/site/use-reveal";
import { downloadIcs, shareEvent } from "@/lib/event-share";
import { buildEventDeepLink, replaceUrl, stripEventParam } from "@/lib/deep-link";

export interface EventDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  tags: string;
  featured: boolean;
  schedule?: string | null;
  rsvpCount: number;
}

interface ScheduleItem {
  time: string;
  title: string;
  detail?: string;
}

/**
 * Per-event ASCII poster — every event gets its own photo piped through the
 * glyph engine inside the full-brief dialog (ASCII.POSTER panel). Falls back
 * gracefully for slugs without a poster yet.
 */
const POSTERS: Record<string, LightboxShot> = {
  "nexus-hack-5.0": {
    src: "/media/poster-hack.png",
    label: "NEXUS_HACK_5.0.POSTER",
    caption: "the hackathon arena at midnight",
  },
  "rover-build-sprint": {
    src: "/media/poster-rover.png",
    label: "ROVER_SPRINT.POSTER",
    caption: "rover on the mini obstacle course",
  },
  "intro-to-transformers": {
    src: "/media/poster-transformers.png",
    label: "TRANSFORMERS.POSTER",
    caption: "attention maps on the whiteboard",
  },
  "cloud-native-sunday": {
    src: "/media/poster-k8s.png",
    label: "K8S_PLAYGROUND.POSTER",
    caption: "orchestration dashboards on the projector",
  },
  "founders-firechat": {
    src: "/media/poster-firechat.png",
    label: "FIRECHAT.POSTER",
    caption: "founders fireside, warm amber",
  },
  "android-from-zero": {
    src: "/media/poster-android.png",
    label: "ANDROID_ZERO.POSTER",
    caption: "jetpack compose live build",
  },
  "cyber-night-ctf": {
    src: "/media/poster-ctf.png",
    label: "CYBERNIGHT_CTF.POSTER",
    caption: "the ctf lab — green terminals everywhere",
  },
}

/** Parse the DB-backed run-of-show JSON defensively. */
function parseSchedule(raw: string | null | undefined): ScheduleItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (it): it is ScheduleItem =>
        !!it && typeof it === "object" && typeof (it as ScheduleItem).time === "string" &&
        typeof (it as ScheduleItem).title === "string"
    );
  } catch {
    return [];
  }
}

const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "Asia/Calcutta" });
const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Calcutta" });
const fmtFull = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Calcutta",
});

/** Live T-minus ticker to the flagship upcoming event (IST). */
function FlagshipCountdown({ target, title, slug }: { target: string; title: string; slug: string }) {
  const [now, setNow] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const ms = now == null ? null : new Date(target).getTime() - now;
  const past = ms != null && ms <= 0;
  const d = ms == null ? 0 : Math.floor(ms / 86400000);
  const h = ms == null ? 0 : Math.floor((ms % 86400000) / 3600000);
  const m = ms == null ? 0 : Math.floor((ms % 3600000) / 60000);
  const s = ms == null ? 0 : Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="hud-corners mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 overflow-hidden rounded-md border border-amber-300/25 bg-gradient-to-r from-amber-300/[0.07] via-card to-card px-5 py-3.5">
      <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-amber-300">
        <Timer className="h-3.5 w-3.5" />
        T-MINUS
      </span>
      <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {ms == null ? (
          <span className="text-muted-foreground">--D --:--:--</span>
        ) : past ? (
          <span className="text-primary">LIVE NOW</span>
        ) : (
          <>
            {d}
            <span className="text-amber-300">D</span> {pad(h)}:{pad(m)}:{pad(s)}
          </>
        )}
      </span>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
        UNTIL <span className="text-foreground/80">{title}</span>
      </span>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(buildEventDeepLink(slug));
            toast({ title: "FLAGSHIP LINK COPIED", description: "opens straight on the RSVP dialog" });
          } catch {
            toast({ title: "CLIPBOARD BLOCKED", description: "link: /?event=nexus-hack-5.0", variant: "destructive" });
          }
        }}
        aria-label="Copy deep link to the flagship event"
        title="copy flagship deep link"
        className="ml-auto flex items-center gap-1.5 rounded-sm border border-amber-300/25 bg-amber-300/5 px-2 py-1 font-mono text-[9px] tracking-[0.25em] text-amber-300/80 transition-all hover:border-amber-300/60 hover:text-amber-300 hover:shadow-[0_0_12px_rgba(251,191,36,0.15)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Link2 className="h-3 w-3" />
        FLAGSHIP LINK
      </button>
    </div>
  );
}

/** RUN OF SHOW — terminal timeline rendered inside the full-brief dialog. */
function ScheduleTimeline({ items }: { items: ScheduleItem[] }) {
  return (
    <div className="mt-5">
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-primary">
        <ListOrdered className="h-3.5 w-3.5" />
        RUN_OF_SHOW
        <span className="text-muted-foreground/50">· {items.length} SEGMENTS</span>
      </p>
      <ol className="relative mt-3 space-y-0 border-l border-primary/20 pl-0">
        {items.map((it, i) => (
          <li key={`${it.time}-${i}`} className="group relative flex gap-3 pb-4 pl-5 last:pb-0">
            {/* node */}
            <span
              aria-hidden="true"
              className="absolute -left-[4.5px] top-1 h-[9px] w-[9px] rotate-45 border border-primary/50 bg-background transition-colors group-hover:border-primary group-hover:bg-primary/70"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-mono text-[10px] font-bold tabular-nums tracking-wider text-amber-300/90">
                  {it.time}
                </span>
                <span className="font-mono text-xs font-bold tracking-wider text-foreground">
                  {it.title}
                </span>
              </div>
              {it.detail && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{it.detail}</p>
              )}
            </div>
            <span
              aria-hidden="true"
              className="hidden shrink-0 font-mono text-[9px] text-muted-foreground/30 group-hover:text-primary/50 sm:block"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EventCard({
  ev,
  onRsvp,
  onDetail,
  featured,
}: {
  ev: EventDTO;
  onRsvp: (ev: EventDTO) => void;
  onDetail: (ev: EventDTO) => void;
  featured?: boolean;
}) {
  const poster = POSTERS[ev.slug];
  const d = new Date(ev.startsAt);
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-md border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(74,222,128,0.08)] ${
        featured ? "border-primary/35 sm:flex-row" : "border-border sm:flex-row"
      }`}
    >
      {/* date block */}
      <div
        className={`flex shrink-0 flex-col items-center justify-center border-b border-border/60 bg-secondary/30 px-6 py-4 font-mono sm:w-28 sm:border-b-0 sm:border-r ${
          featured ? "sm:py-8" : ""
        }`}
      >
        <span className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
          {fmtDay.format(d)}
        </span>
        <span className="text-[11px] uppercase tracking-[0.3em] text-primary">
          {fmtMonth.format(d)}
        </span>
      </div>

      {/* ASCII poster thumb — live glyph render, lights up on card hover */}
      {poster && (
        <AsciiThumb
          src={poster.src}
          onClick={() => onDetail(ev)}
          ariaLabel={`Open ${ev.title} full brief`}
          className={`my-4 mr-4 shrink-0 self-stretch rounded-sm border border-border/60 opacity-75 transition-all duration-300 group-hover:border-primary/40 group-hover:opacity-100 group-hover:shadow-[inset_0_0_18px_rgba(74,222,128,0.12)] ${
            featured ? "hidden w-36 md:block lg:w-44" : "hidden w-24 sm:block"
          } ${featured ? "group-hover:shadow-[0_0_18px_rgba(251,191,36,0.10)]" : ""}`}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-sm px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] ${
              ev.category === "HACKATHON"
                ? "bg-amber-300/10 text-amber-300"
                : "bg-primary/10 text-primary"
            }`}
          >
            {ev.category}
          </span>
          {ev.featured && (
            <span className="rounded-sm border border-primary/40 px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] text-primary">
              ★ FLAGSHIP
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {ev.rsvpCount} going
          </span>
        </div>

        <h3 className="font-display mt-3 text-lg font-bold text-foreground sm:text-xl">
          <button
            onClick={() => onDetail(ev)}
            aria-haspopup="dialog"
            className="text-left transition-colors hover:text-primary"
            title="open full brief"
          >
            {ev.title}
          </button>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {ev.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-primary/60" />
            {fmtFull.format(d)} IST
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary/60" />
            {ev.venue}
          </span>
          {parseSchedule(ev.schedule).length > 0 && (
            <span className="flex items-center gap-1.5 text-primary/60 transition-colors group-hover:text-primary/90">
              <ListOrdered className="h-3 w-3" />
              RUN OF SHOW
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {ev.tags.split(",").slice(0, 3).map((t) => (
              <span key={t} className="font-mono text-[9px] text-primary/50">
                #{t.trim()}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Share ${ev.title}`}
              title="share invite"
              onClick={async () => {
                const res = await shareEvent({
                  slug: ev.slug,
                  title: ev.title,
                  description: ev.description,
                });
                toast({
                  title: res.ok
                    ? res.via === "share"
                      ? "SIGNAL BEAMED"
                      : "COPIED TO CLIPBOARD"
                    : "SIGNAL BLOCKED",
                  description: res.message,
                  variant: res.ok ? undefined : "destructive",
                });
              }}
              className="h-8 px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">SHARE</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Download ${ev.title} as calendar file`}
              title="add to calendar (.ics)"
              onClick={() => {
                downloadIcs({
                  uid: ev.id,
                  slug: ev.slug,
                  title: ev.title,
                  description: ev.description,
                  venue: ev.venue,
                  startsAt: ev.startsAt,
                  endsAt: ev.endsAt,
                });
                toast({
                  title: "CALENDAR PATCHED",
                  description: `${ev.slug}.ics downloaded — see you there.`,
                });
              }}
              className="h-8 px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">.ICS</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRsvp(ev)}
              className="h-8 border-primary/40 px-4 font-mono text-[10px] tracking-widest text-primary hover:bg-primary/15 hover:text-primary"
            >
              RSVP_
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * MY.RSVP — self-service lookup. Enter the email you RSVP'd with and the
 * grid echoes back every transmit you're on the list for.
 */
function MyRsvpLookup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [rsvps, setRsvps] = useState<
    { slug: string; title: string; venue: string; startsAt: string; featured: boolean }[]
  >([]);

  const scan = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setState("error");
      return;
    }
    setState("scanning");
    try {
      const res = await fetch(`/api/rsvp-lookup?email=${encodeURIComponent(value)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { rsvps: typeof rsvps };
      setRsvps(data.rsvps);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mt-10 rounded-md border border-dashed border-primary/25 bg-card/40 p-5 font-mono">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label
          htmlFor="my-rsvp-email"
          className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-primary"
        >
          <ScanLine className="h-3.5 w-3.5" />
          MY.RSVP — AM I ON THE LIST?
        </label>
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <span className="shrink-0 text-sm text-amber-300">$</span>
          <input
            id="my-rsvp-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="rsvp email → nexus events --mine"
            aria-label="Email used for RSVP"
            className="h-8 min-w-0 flex-1 rounded-sm border border-input bg-background/70 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            onClick={scan}
            disabled={state === "scanning"}
            className="h-8 shrink-0 rounded-sm border border-primary/40 bg-primary/10 px-3 text-[10px] tracking-[0.2em] text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {state === "scanning" ? "SCANNING…" : "SCAN"}
          </button>
        </div>
      </div>

      {state === "error" && (
        <p className="mt-3 text-[10px] tracking-widest text-destructive" role="alert">
          uplink fault — check the email and retry.
        </p>
      )}
      {state === "done" && rsvps.length === 0 && (
        <p className="mt-3 text-[10px] tracking-widest text-muted-foreground">
          no transmits found for that address — RSVP to something below ↓
        </p>
      )}
      {rsvps.length > 0 && (
        <ul className="thin-scroll mt-4 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {rsvps.map((r, i) => (
            <li
              key={r.slug}
              className="rsvp-row flex flex-wrap items-center gap-x-3 gap-y-1 border border-border/50 bg-background/50 px-3 py-2 text-[10px]"
              style={{ "--stagger": `${i * 70}ms` } as React.CSSProperties}
            >
              {r.featured && <span className="led led-amber shrink-0" title="flagship" />}
              <span className="font-bold tracking-wider text-foreground">{r.title}</span>
              <span className="text-muted-foreground">{fmtFull.format(new Date(r.startsAt))} IST</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 text-primary/60" />
                {r.venue}
              </span>
              <span className="ml-auto rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-primary">
                ✓ ON LIST
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventsSection() {
  const [events, setEvents] = useState<EventDTO[] | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dialogEv, setDialogEv] = useState<EventDTO | null>(null);
  const [detailEv, setDetailEv] = useState<EventDTO | null>(null);
  const [posterLightbox, setPosterLightbox] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { ref, seen } = useReveal<HTMLDivElement>();
  // guards the StrictMode double-run of the ?event= deep-link effect
  const deepLinked = useRef(false);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => setEvents(data.events as EventDTO[]))
      .catch(() => setEvents([]));
  }, []);

  // deep link: /?event=<slug> → land on the schedule with the event's dialog
  // pre-opened (RSVP for upcoming, full brief for past). Param is scrubbed
  // afterwards so refreshes and shares stay clean.
  useEffect(() => {
    if (events === null || deepLinked.current) return;
    deepLinked.current = true;
    const slug = new URLSearchParams(window.location.search).get("event");
    if (!slug) return;
    const ev = events.find((e) => e.slug === slug);
    stripEventParam(); // scrub first so a dialog-cycle refresh never re-triggers
    if (!ev) {
      toast({ title: "UNKNOWN EVENT", description: `no transmit matches "${slug}"`, variant: "destructive" });
      return;
    }
    document.getElementById("events")?.scrollIntoView({ behavior: "instant" });
    const upcoming = new Date(ev.startsAt).getTime() >= Date.now();
    if (upcoming) setDialogEv(ev);
    else setDetailEv(ev);
    // the flight engine writes #scene-* from the scroll event fired by the
    // jump above — re-assert #events once that event has been flushed
    window.setTimeout(() => replaceUrl(`${window.location.pathname}#events`), 160);
    toast({
      title: upcoming ? "DEEP LINK — RSVP PRESELECTED" : "DEEP LINK — ARCHIVE BRIEF",
      description: ev.title,
    });
  }, [events, toast]);

  const { upcoming, past, featured } = useMemo(() => {
    const now = Date.now();
    const list = events ?? [];
    const up = list.filter((e) => new Date(e.startsAt).getTime() >= now);
    const pa = list.filter((e) => new Date(e.startsAt).getTime() < now);
    return {
      upcoming: up.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
      past: pa.sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)),
      featured: up.find((e) => e.featured) ?? null,
    };
  }, [events]);

  const shown = tab === "upcoming" ? upcoming : past;

  const submitRsvp = async () => {
    if (!dialogEv) return;
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast({
        title: "INVALID INPUT",
        description: "name required · email must parse. try again.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${dialogEv.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "rsvp failed");
      toast({
        title: "RSVP CONFIRMED",
        description: `${name.trim()} is on the list for ${dialogEv.title}.`,
      });
      setEvents((prev) =>
        (prev ?? []).map((e) =>
          e.id === dialogEv.id ? { ...e, rsvpCount: data.rsvpCount ?? e.rsvpCount + 1 } : e
        )
      );
      setDialogEv(null);
      setName("");
      setEmail("");
    } catch (err) {
      toast({
        title: "TRANSMISSION FAILED",
        description: err instanceof Error ? err.message : "unknown fault",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="events" className="relative border-b border-border/60 bg-[#060a07]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-primary">03 / EVENTS</p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Transmit schedule
              </h2>
            </div>
            {/* subscription feeds + tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/calendar.ics"
                download="nexus-transmit-schedule.ics"
                title="subscribe — every event, any calendar app"
                className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground transition-all hover:border-primary/50 hover:text-primary hover:shadow-[0_0_12px_rgba(74,222,128,0.15)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                ALL.ICS
              </a>
              <a
                href="/api/feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                title="RSS wire feed"
                className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground transition-all hover:border-amber-300/50 hover:text-amber-300 hover:shadow-[0_0_12px_rgba(251,191,36,0.12)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Rss className="h-3.5 w-3.5" />
                RSS
              </a>
              <div className="flex overflow-hidden rounded-sm border border-border font-mono text-[11px]">
                {(["upcoming", "past"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    className={`px-4 py-2 tracking-[0.2em] transition-colors ${
                      tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    --{t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* flagship countdown */}
          {tab === "upcoming" && featured && (
            <FlagshipCountdown target={featured.startsAt} title={featured.title} slug={featured.slug} />
          )}

          {/* featured */}
          {tab === "upcoming" && featured && (
            <div className="mt-8">
              <EventCard ev={featured} onRsvp={setDialogEv} onDetail={setDetailEv} featured />
            </div>
          )}

          {/* list */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {events === null
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-md border border-border bg-card p-5">
                    <Skeleton className="h-4 w-24 bg-secondary" />
                    <Skeleton className="mt-4 h-6 w-3/4 bg-secondary" />
                    <Skeleton className="mt-3 h-4 w-full bg-secondary" />
                    <Skeleton className="mt-8 h-8 w-28 bg-secondary" />
                  </div>
                ))
              : shown
                  .filter((e) => e.id !== featured?.id || tab === "past")
                  .map((ev) => (
                    <EventCard key={ev.id} ev={ev} onRsvp={setDialogEv} onDetail={setDetailEv} />
                  ))}
          </div>

          {/* terminal empty state */}
          {events !== null && shown.length === 0 && (
            <div className="mt-6 rounded-md border border-border bg-card/60 p-6 font-mono text-sm">
              <p className="text-muted-foreground">
                <span className="text-amber-300">$</span> nexus events --{tab}
              </p>
              <p className="mt-2 text-primary/70">
                {tab === "upcoming"
                  ? "there are no events planned... yet. standby."
                  : "archive empty. history starts with you."}
              </p>
              <p className="mt-2 text-muted-foreground/60">
                <span className="cursor-blink inline-block h-4 w-2 translate-y-0.5 bg-primary/70" />
              </p>
            </div>
          )}

          {/* self-service rsvp lookup */}
          <MyRsvpLookup />
        </div>
      </div>

      {/* RSVP dialog */}
      <Dialog open={!!dialogEv} onOpenChange={(o) => !o && setDialogEv(null)}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground">
              RSVP · {dialogEv?.title}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] text-muted-foreground">
              reserve a seat on the list. confirmation hits your inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="rsvp-name" className="font-mono text-[10px] tracking-widest text-muted-foreground">
                NAME
              </Label>
              <Input
                id="rsvp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ada lovelace"
                className="border-border bg-secondary/40 font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rsvp-email" className="font-mono text-[10px] tracking-widest text-muted-foreground">
                EMAIL
              </Label>
              <Input
                id="rsvp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vitstudent.ac.in"
                className="border-border bg-secondary/40 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submitRsvp}
              disabled={submitting}
              className="w-full font-mono text-xs tracking-widest"
            >
              {submitting ? "TRANSMITTING…" : "CONFIRM_RSVP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* full-brief dialog */}
      <Dialog
        open={!!detailEv}
        onOpenChange={(o) => {
          if (!o) {
            setDetailEv(null);
            setPosterLightbox(false);
          }
        }}
      >
        <DialogContent className="thin-scroll max-h-[85vh] overflow-y-auto border-border bg-card p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/70 bg-secondary/40 px-5 py-3">
            <DialogTitle className="sr-only">{detailEv?.title}</DialogTitle>
            <DialogDescription className="sr-only">full event brief</DialogDescription>
          </DialogHeader>
          {detailEv && (
            <div className="px-5 pb-5 pt-4">
              {/* ASCII banner header — typeset by the same glyph engine */}
              <div className="rounded-sm border border-border/60 bg-[#070d08] px-3 py-3">
                <AsciiBanner text={detailEv.title} cols={90} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-sm px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] ${
                    detailEv.category === "HACKATHON"
                      ? "bg-amber-300/10 text-amber-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {detailEv.category}
                </span>
                {detailEv.featured && (
                  <span className="rounded-sm border border-primary/40 px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] text-primary">
                    ★ FLAGSHIP
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {detailEv.rsvpCount} going
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-foreground/85">
                {detailEv.description}
              </p>

              <div className="mt-4 grid gap-2 rounded-sm border border-border/60 bg-secondary/30 p-3 font-mono text-[11px]">
                <span className="flex items-center gap-2 text-foreground/80">
                  <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                  {fmtFull.format(new Date(detailEv.startsAt))} IST
                </span>
                <span className="flex items-center gap-2 text-foreground/80">
                  <MapPin className="h-3.5 w-3.5 text-primary/70" />
                  {detailEv.venue}
                </span>
              </div>

              {/* ASCII.POSTER — this event's still, live through the glyph engine */}
              {(() => {
                const poster = POSTERS[detailEv.slug];
                if (!poster) return null;
                return (
                  <div className="poster-frame mt-4 overflow-hidden rounded-md">
                    <AsciiImage
                      {...poster}
                      compact
                      onExpand={() => setPosterLightbox(true)}
                    />
                  </div>
                );
              })()}

              {(() => {
                const items = parseSchedule(detailEv.schedule);
                return items.length > 0 ? <ScheduleTimeline items={items} /> : null;
              })()}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {detailEv.tags.split(",").map((t) => (
                  <span key={t} className="font-mono text-[9px] text-primary/50">
                    #{t.trim()}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await shareEvent({
                      slug: detailEv.slug,
                      title: detailEv.title,
                      description: detailEv.description,
                    });
                    toast({
                      title: res.ok
                        ? res.via === "share"
                          ? "SIGNAL BEAMED"
                          : "COPIED TO CLIPBOARD"
                        : "SIGNAL BLOCKED",
                      description: res.message,
                      variant: res.ok ? undefined : "destructive",
                    });
                  }}
                  className="h-8 px-3 font-mono text-[10px] tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  SHARE
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    downloadIcs({
                      uid: detailEv.id,
                      slug: detailEv.slug,
                      title: detailEv.title,
                      description: detailEv.description,
                      venue: detailEv.venue,
                      startsAt: detailEv.startsAt,
                      endsAt: detailEv.endsAt,
                    });
                    toast({
                      title: "CALENDAR PATCHED",
                      description: `${detailEv.slug}.ics downloaded — see you there.`,
                    });
                  }}
                  className="h-8 px-3 font-mono text-[10px] tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  .ICS
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDetailEv(null);
                    setDialogEv(detailEv);
                  }}
                  className="h-8 border border-primary/40 bg-primary/10 px-4 font-mono text-[10px] tracking-widest text-primary hover:bg-primary/20"
                >
                  RSVP_
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* poster lightbox — sits above the brief dialog (z-90, capture-phase ESC) */}
      {posterLightbox && detailEv && POSTERS[detailEv.slug] && (
        <AsciiLightbox
          shots={[POSTERS[detailEv.slug]]}
          index={0}
          onClose={() => setPosterLightbox(false)}
          onNavigate={() => {}}
        />
      )}
    </section>
  );
}
