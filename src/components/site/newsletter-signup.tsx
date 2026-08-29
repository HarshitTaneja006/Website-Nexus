"use client";

import { useState } from "react";
import { Radio, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * SignalWire — footer newsletter signup. One email in, an idempotent
 * subscription out; the panel echoes the live wire total.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const { toast } = useToast();

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
      setDone(true);
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

  return (
    <div className="mt-10 border-t border-border/50 pt-8">
      <div className="hud-corners mx-auto max-w-2xl rounded-md border border-border/70 bg-secondary/20 p-5 sm:p-6">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-primary">
          <span aria-hidden="true" className={`led ${done ? "led-amber" : ""}`} />
          <Radio className="h-3.5 w-3.5" />
          {done ? "SIGNAL.WIRE — LINK ACTIVE" : "SIGNAL.WIRE — EVENT PINGS, NO SPAM"}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          one transmission per event: launch announcements, hackathon calls and
          workshop drops. unsubscribe anytime.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-sm border border-transparent p-0.5 font-mono transition-colors focus-within:border-primary/40">
          <span className="shrink-0 pl-1.5 text-sm text-amber-300">$</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && subscribe()}
            disabled={done}
            placeholder="you@vitstudent.ac.in"
            aria-label="Email address for the Signal.Wire newsletter"
            className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background/70 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <button
            onClick={subscribe}
            disabled={busy || done}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-4 font-mono text-[10px] tracking-[0.2em] text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_14px_rgba(74,222,128,0.25)] focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            {done ? "TAPPED" : busy ? "SENDING…" : "SUBSCRIBE"}
          </button>
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
          <span aria-hidden="true" className="dotline hidden h-px w-16 sm:inline-block" />
        </p>
      </div>
    </div>
  );
}
