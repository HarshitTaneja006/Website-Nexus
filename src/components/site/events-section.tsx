"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
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
  rsvpCount: number;
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

function EventCard({
  ev,
  onRsvp,
  featured,
}: {
  ev: EventDTO;
  onRsvp: (ev: EventDTO) => void;
  featured?: boolean;
}) {
  const d = new Date(ev.startsAt);
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-md border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(74,222,128,0.08)] ${
        featured ? "border-primary/35 sm:flex-row" : "border-border"
      }`}
    >
      {/* date block */}
      <div
        className={`flex shrink-0 flex-col items-center justify-center border-b border-border/60 bg-secondary/30 px-6 py-4 font-mono sm:w-28 sm:border-b-0 ${
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

      <div className="flex flex-1 flex-col p-5">
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

        <h3 className="font-display mt-3 text-lg font-bold text-foreground group-hover:text-primary sm:text-xl">
          {ev.title}
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
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {ev.tags.split(",").slice(0, 3).map((t) => (
              <span key={t} className="font-mono text-[9px] text-primary/50">
                #{t.trim()}
              </span>
            ))}
          </div>
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
    </article>
  );
}

export function EventsSection() {
  const [events, setEvents] = useState<EventDTO[] | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dialogEv, setDialogEv] = useState<EventDTO | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { ref, seen } = useReveal<HTMLDivElement>();

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => setEvents(data.events as EventDTO[]))
      .catch(() => setEvents([]));
  }, []);

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
            {/* tabs */}
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

          {/* featured */}
          {tab === "upcoming" && featured && (
            <div className="mt-8">
              <EventCard ev={featured} onRsvp={setDialogEv} featured />
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
                  .map((ev) => <EventCard key={ev.id} ev={ev} onRsvp={setDialogEv} />)}
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
    </section>
  );
}
