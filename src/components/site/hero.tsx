"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ChevronDown } from "lucide-react";
import { AsciiCanvas, type AsciiPreset } from "@/components/ascii/ascii-canvas";
import { usePresence } from "@/hooks/use-presence";

const ASCII_LOGO = String.raw`███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const STATS = [
  { value: 120, suffix: "+", label: "ACTIVE MEMBERS" },
  { value: 15, suffix: "", label: "EVENTS SHIPPED" },
  { value: 5, suffix: "", label: "DOMAINS" },
];

const TICKER = [
  "AI / ML",
  "WEB ENGINEERING",
  "CLOUD & DEVOPS",
  "MOBILE DEV",
  "OPEN SOURCE",
  "DEVTOOLS & SYSTEMS",
  "FULL STACK",
  "HACKATHONS",
];

function useCountUp(target: number, run: boolean, duration = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const id = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return v;
}

function Stat({ value, suffix, label, run }: { value: number; suffix: string; label: string; run: boolean }) {
  const v = useCountUp(value, run);
  return (
    <div className="flex flex-col items-center gap-1 sm:items-start">
      <span className="font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
        {v}
        <span className="text-primary">{suffix}</span>
      </span>
      <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">{label}</span>
    </div>
  );
}

export function Hero() {
  const [preset, setPreset] = useState<AsciiPreset>("rain");
  const [runStats, setRunStats] = useState(false);
  // live feed signal chain readout - what's actually on air in CAM mode
  const [feedSrc, setFeedSrc] = useState<"cam" | "synth" | null>(null);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const { online } = usePresence();

  // remote control: ⌘K palette (or anywhere else) can switch the engine
  useEffect(() => {
    const onEngine = (e: Event) => {
      const p = (e as CustomEvent).detail;
      if (p === "rain" || p === "wave" || p === "donut" || p === "cam") setPreset(p);
    };
    window.addEventListener("nexus:engine", onEngine);
    return () => window.removeEventListener("nexus:engine", onEngine);
  }, []);

  // the cam preset broadcasts its signal-chain state (webcam granted vs
  // synth fallback vs offline) so the HUD shows the true source
  useEffect(() => {
    const onFeed = (e: Event) => {
      const { source, state, message } = (e as CustomEvent<{
        source: "cam" | "synth" | null;
        state: string;
        message?: string;
      }>).detail;
      setFeedSrc(source);
      setFeedMsg(state === "live" ? null : message ?? null);
    };
    window.addEventListener("nexus:hero-feed", onFeed);
    return () => window.removeEventListener("nexus:hero-feed", onFeed);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRunStats(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="top" className="relative flex min-h-svh flex-col overflow-hidden">
      {/* ascii background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700"
        style={{
          opacity:
            preset === "donut" ? 0.55 : preset === "cam" ? 0.85 : preset === "wave" ? 0.34 : 0.3,
        }}
      >
        <AsciiCanvas
          key={preset}
          preset={preset}
          className="h-full w-full"
          fontSize={11}
          speed={preset === "donut" ? 1.15 : 1}
        />
      </div>
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,8,13,0.88)_92%)]" />
      <div className="scanlines pointer-events-none absolute inset-0 -z-10" />

      {/* top corner readouts */}
      <div className="pointer-events-none absolute left-4 top-20 hidden font-mono text-[9px] leading-relaxed text-primary/40 sm:block md:left-8">
        <p>SYS.ONLINE <span className="led ml-1 inline-block align-middle" /></p>
        <p>NODE: VIT-CHENNAI</p>
        <p>12.9066° N, 80.0406° E</p>
      </div>
      <div className="pointer-events-none absolute right-4 top-20 hidden text-right font-mono text-[9px] leading-relaxed text-primary/40 sm:block md:right-8">
        <p>
          BUILDERS ON GRID: <span className="tabular-nums text-primary/80">{online == null ? "--" : online}</span>
        </p>
        <p>ASCII ENGINE: ACTIVE</p>
        <p>MODE: 32K PHOSPHOR</p>
        <p>FRAME: GLYPH/RASTER</p>
      </div>

      {/* engine switcher - z-20: the content column below is also z-10 and
          later in DOM order, so it would swallow clicks aimed at these
          buttons (the "camera backdrop doesn't work" bug) */}
      <div className="absolute right-4 bottom-24 z-20 hidden flex-col items-end gap-1.5 sm:flex md:right-8">
        <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground">BG_ENGINE:</span>
        <div className="flex overflow-hidden rounded-sm border border-border bg-card/70 backdrop-blur-sm">
          {(["rain", "wave", "donut", "cam"] as AsciiPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
              title={p === "cam" ? "live glyph feed - webcam, auto synth fallback" : `hero preset: ${p}`}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70 ${
                preset === p ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "cam" ? "◉ cam" : p}
            </button>
          ))}
        </div>
        {preset === "cam" && (
          <span
            className={`font-mono text-[9px] tracking-[0.2em] ${
              feedSrc === "cam" ? "text-amber-300/80" : feedSrc === "synth" ? "text-primary/80" : "text-muted-foreground/70"
            }`}
          >
            {feedSrc === "cam" && "LIVE GLYPH FEED - SRC: CAM.LIVE ◉"}
            {feedSrc === "synth" && "LIVE GLYPH FEED - SRC: SYNTH.FEED (CAMERA UNAVAILABLE)"}
            {!feedSrc && (feedMsg ?? "SPOOLING SIGNAL CHAIN - CAM → SYNTH")}
          </span>
        )}
        {/* frame dump - serialize the live engine grid to .txt / print .png */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/70">
            FRAME_DUMP:
          </span>
          <div className="flex overflow-hidden rounded-sm border border-border bg-card/70 backdrop-blur-sm">
            {(["txt", "png"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("nexus:hero-dump", { detail: { format: fmt } }))
                }
                title={fmt === "txt" ? "dump current glyph grid → .txt artifact" : "print current glyph grid → .png typographic print"}
                className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
              >
                .{fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-24 text-center sm:px-6">
        <img
          src="/logo.svg"
          alt="NEXUS club logo"
          className="mb-5 h-11 w-11 sm:h-12 sm:w-12 drop-shadow-[0_0_14px_rgba(63,90,143,0.55)]"
        />
        <p className="mb-5 font-mono text-[11px] tracking-[0.3em] text-primary/80">
          <span className="text-amber-300">$</span> whoami
        </p>
        <p className="mb-4 font-mono text-xs tracking-[0.24em] text-muted-foreground sm:text-sm">
          STUDENT TECH COLLECTIVE - VIT CHENNAI
        </p>

        {/* wordmark with ASCII echo */}
        <div className="relative">
          <pre
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[4px] leading-[1.2] text-primary/25 md:text-[6px]"
          >
            {ASCII_LOGO}
          </pre>
          <h1 className="font-display glitch-hover relative select-none text-[19vw] font-bold leading-[0.9] tracking-[-0.04em] text-foreground text-glow sm:text-[15vw] lg:text-[10.5rem]">
            NEXUS
          </h1>
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-sm tracking-[0.35em] text-foreground/90 sm:text-base">
          <span>INNOVATE</span>
          <span className="text-primary">◆</span>
          <span>LEAD</span>
          <span className="text-primary">◆</span>
          <span className="text-glow-amber text-amber-300">BUILD</span>
        </p>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          One club, five software domains, zero spectator mode. We architect web
          platforms, train neural models, build scalable backends and ship
          open-source software together.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#forge"
            className="group inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-mono text-xs font-bold tracking-widest text-primary-foreground transition-all hover:shadow-[0_0_28px_rgba(96,165,250,0.45)]"
          >
            ENTER THE FOUNDRY
            <ArrowDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
          </a>
          <a
            href="https://nexusrecruitment.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/5 px-6 py-3 font-mono text-xs font-bold tracking-widest text-primary transition-colors hover:bg-primary/15"
          >
            JOIN NEXUS
          </a>
        </div>

        {/* stats */}
        <div
          ref={statsRef}
          className="mt-14 grid w-full max-w-xl grid-cols-3 gap-x-4 gap-y-6 border-y border-border/50 py-5 sm:gap-x-10"
        >
          {STATS.map((s) => (
            <Stat key={s.label} {...s} run={runStats} />
          ))}
        </div>
      </div>

      {/* scroll hint */}
      <div className="relative z-10 flex justify-center pb-2">
        <div className="flex animate-bounce flex-col items-center gap-1 font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
          SCROLL
          <ChevronDown className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>

      {/* ticker */}
      <div className="relative z-10 overflow-hidden border-t border-border/60 bg-[#070d16]/80 py-2.5 backdrop-blur-sm">
        <div className="marquee-track">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0 items-center" aria-hidden={half === 1}>
              {TICKER.map((t) => (
                <span key={`${half}-${t}`} className="flex items-center font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
                  <span className="px-5">{t}</span>
                  <span className="text-primary/60">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
