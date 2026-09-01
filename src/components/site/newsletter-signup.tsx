"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Send, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * SignalWire — footer newsletter signup. One email in, an idempotent
 * subscription out; the panel echoes the live wire total.
 * Opt-out: the LINK ACTIVE state offers a one-tap sever, and ?unsub=<email>
 * deep links (from real transmissions) auto-fire the same DELETE endpoint —
 * genuine one-click unsubscribe, then the param is scrubbed from the URL.
 */

type WireState = "idle" | "linked" | "severed";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<WireState>("idle");
  const [total, setTotal] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { toast } = useToast();
  const firedUnsub = useRef(false); // guard against StrictMode double-fire

  const subscribe = async () => {
    const value = email.trim();
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast({
        title: "INVALID FREQUENCY",
        description: "that email won't parse — check it and retry.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as { ok?: boolean; already?: boolean; total?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "wire fault");
      setTotal(data.total ?? null);
      setState("linked");
      setNotice(null);
      toast({
        title: data.already ? "ALREADY ON THE WIRE" : "WIRE TAPPED",
        description: data.already
          ? "you're subscribed — first ping lands with the next event."
          : `subscribed · you are node #${data.total} on the wire`,
      });
    } catch (err) {
      toast({
        title: "TRANSMISSION FAILED",
        description: err instanceof Error ? err.message : "unknown fault",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const optOut = useCallback(
    async (value: string) => {
      const target = value.trim();
      if (busy || !target) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/newsletter?email=${encodeURIComponent(target)}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { ok?: boolean; removed?: boolean; total?: number; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "wire fault");
        setTotal(data.total ?? null);
        setState("severed");
        setNotice(
          data.removed
            ? `${target} removed — zero further transmissions.`
            : `${target} wasn't on the wire — nothing to remove.`
        );
        toast({
          title: data.removed ? "LINK SEVERED" : "NOT ON THE WIRE",
          description: data.removed
            ? "unsubscribed — the grid respects your frequency."
            : "that address has no active subscription.",
        });
      } catch (err) {
        toast({
          title: "SEVER FAILED",
          description: err instanceof Error ? err.message : "unknown fault",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, toast]
  );

  // one-click unsubscribe deep link: /?unsub=<email>
  useEffect(() => {
    if (firedUnsub.current) return;
    const raw = new URLSearchParams(window.location.search).get("unsub");
    if (!raw) return;
    firedUnsub.current = true;
    const target = raw.trim().toLowerCase();
    setEmail(target);
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      void optOut(target);
    }
    // scrub the param so refreshes don't re-fire
    const url = new URL(window.location.href);
    url.searchParams.delete("unsub");
    window.history.replaceState({}, "", url.toString());
  }, [optOut]);

  const linked = state === "linked";

  return (
    <div className="mt-10 border-t border-border/50 pt-8">
      <div className={`hud-corners mx-auto max-w-2xl rounded-md border border-border/70 bg-secondary/20 p-5 transition-colors duration-500 sm:p-6 ${linked ? "hud-corners-amber" : ""}`}>
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-primary">
          <span aria-hidden="true" className={`led ${linked ? "led-amber" : ""}`} />
          <Radio className="h-3.5 w-3.5" />
          {linked
            ? "SIGNAL.WIRE — LINK ACTIVE"
            : state === "severed"
              ? "SIGNAL.WIRE — LINK SEVERED"
              : "SIGNAL.WIRE — EVENT PINGS, NO SPAM"}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          one transmission per event: launch announcements, hackathon calls and
          workshop drops. unsubscribe anytime.
        </p>
        <div className={`mt-4 flex items-center gap-2 rounded-sm border p-0.5 font-mono transition-colors focus-within:border-primary/40 ${linked ? "border-amber-300/25" : "border-transparent"}`}>
          <span className="shrink-0 pl-1.5 text-sm text-amber-300">$</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (linked) void optOut(email);
                else void subscribe();
              }
            }}
            disabled={linked && busy}
            placeholder="you@vitstudent.ac.in"
            aria-label="Email address for the Signal.Wire newsletter"
            className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background/70 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          {linked ? (
            <button
              onClick={() => void optOut(email)}
              disabled={busy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-destructive/40 bg-destructive/5 px-4 font-mono text-[10px] tracking-[0.2em] text-destructive/90 transition-all hover:bg-destructive/15 hover:shadow-[0_0_14px_rgba(248,113,113,0.2)] focus-visible:ring-1 focus-visible:ring-destructive disabled:opacity-50"
            >
              <Unlink className="h-3 w-3" />
              {busy ? "SEVERING…" : "OPT OUT"}
            </button>
          ) : (
            <button
              onClick={subscribe}
              disabled={busy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-4 font-mono text-[10px] tracking-[0.2em] text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_14px_rgba(96,165,250,0.25)] focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              {state === "severed" && !busy ? "RE-TAP" : busy ? "SENDING…" : "SUBSCRIBE"}
            </button>
          )}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 font-mono text-[9px] tracking-widest text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            {total != null && (
              <span aria-hidden="true" className="led led-amber" />
            )}
            {total != null
              ? `${total} NODE${total === 1 ? "" : "S"} ON THE WIRE`
              : "STORAGE: PRISMA · FREQUENCY: PER EVENT"}
          </span>
          {notice && (
            <span className="text-primary/70" role="status">
              {notice}
            </span>
          )}
          <span aria-hidden="true" className="dotline hidden h-px w-16 sm:inline-block" />
        </p>
      </div>
    </div>
  );
}
