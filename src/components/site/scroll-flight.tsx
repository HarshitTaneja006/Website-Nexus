"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * ScrollFlight v2 — ONE scene, ONE continuous camera, FIVE acts.
 *
 * Redesign brief (user): "redesign the flight to be only one high quality
 * scene — improvise, browse ui libraries, grill me."
 *
 * The v1 engine crossfaded four separate stills with seam dissolves.
 * v2 throws the seams away: a single 2688×1536 shot of the NEXUS world
 * (public/media/world-nexus.webp) becomes the flight, and the scroll
 * drives ONE virtual camera along a continuous pose path — dolly, pan,
 * bank — through five keyframed acts. Act boundaries are shared poses,
 * so there is nothing to crossfade: it reads as a single unbroken take.
 *
 * Engine notes (what "browsing ui libraries" bought us):
 * - Lenis-style lerp: the camera never snaps to scroll — every frame it
 *   glides toward the scroll-derived pose (`cur += (target-cur)*α`), the
 *   same exponential-smoothing trick Lenis applies to scrollTop. Wheel
 *   flicks become dolly momentum; the shot feels filmed, not scrubbed.
 * - GSAP ScrollTrigger scrub grammar: pin (sticky) + scrub progress + a
 *   plateau ease per act (dwell at both ends of every keyframe) so each
 *   act holds its frame long enough to be read.
 * - Acts are data: pose keyframes (scale / focal point / bank angle),
 *   copy, accent tint. Adding an act = adding a table row.
 *
 * Deep links: #scene-gate|lab|build|uplink (+ legacy #scene-community →
 * uplink) land mid-shot; ?scene= works too and unfurls its OG card.
 * Keys 0–4 jump between acts.
 */

interface Pose {
  s: number; // camera scale (1 = cover-fit)
  fx: number; // focal point, fraction of image width
  fy: number; // focal point, fraction of image height
  r: number; // bank angle, degrees
}

interface Act {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  tags: string[];
  accent: string;
  tint: string; // radial grade color at low alpha
  from: Pose;
  to: Pose;
  w: number; // scroll length, viewport heights
}

const WORLD = "/media/world-nexus.webp";

/** client-only flags (SSR-safe: server snapshot is false) */
function subscribeNoop(cb: () => void) {
  void cb;
  return () => {};
}
function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

const ACTS: Act[] = [
  {
    id: "overwatch",
    label: "OVERWATCH",
    eyebrow: "ACT 00 · OVERWATCH",
    title: "One City Block. One Shot.",
    body: "Your scroll is the throttle. No cuts, no dissolves — one continuous pass over the block the collective calls home. Five moves, single take.",
    tags: ["ONE SHOT", "SCROLL-SCRUB", "NIGHT OPS"],
    accent: "#4ade80",
    tint: "74,222,128",
    from: { s: 1.02, fx: 0.5, fy: 0.46, r: 0 },
    to: { s: 1.3, fx: 0.5, fy: 0.5, r: 0 },
    w: 1.5,
  },
  {
    id: "gate",
    label: "THE GATE",
    eyebrow: "ACT 01 · ARRIVAL",
    title: "The Campus Grid",
    body: "Every build starts here. One plaza, one green door, hundreds of students routing energy into the same network — welcome to the NEXUS node.",
    tags: ["COMMUNITY", "VIT CHENNAI", "EST. 2019"],
    accent: "#4ade80",
    tint: "74,222,128",
    from: { s: 1.3, fx: 0.5, fy: 0.5, r: 0 },
    to: { s: 2.0, fx: 0.505, fy: 0.545, r: -1.1 },
    w: 1.3,
  },
  {
    id: "lab",
    label: "THE LAB",
    eyebrow: "ACT 02 · RESEARCH",
    title: "Where Prototypes Breathe",
    body: "Robotics bays, GPU boxes and a soldering bench that never sleeps. This is where 2 a.m. ideas get chassis, firmware and a demo video.",
    tags: ["ROBOTICS", "AI/ML", "IOT"],
    accent: "#a7f3d0",
    tint: "167,243,208",
    from: { s: 2.0, fx: 0.505, fy: 0.545, r: -1.1 },
    to: { s: 1.92, fx: 0.215, fy: 0.645, r: 0.9 },
    w: 1.3,
  },
  {
    id: "build",
    label: "THE BUILD",
    eyebrow: "ACT 03 · SHIP IT",
    title: "36 Hours. One Shot.",
    body: "Hack nights are our heartbeat — desks glow, repos multiply, and by sunrise something exists that didn't yesterday. Demo or it didn't happen.",
    tags: ["HACKATHON", "OPEN SOURCE", "SHIPPING"],
    accent: "#fbbf24",
    tint: "251,191,36",
    from: { s: 1.92, fx: 0.21, fy: 0.61, r: 0.9 },
    to: { s: 2.3, fx: 0.725, fy: 0.62, r: -0.7 },
    w: 1.3,
  },
  {
    id: "uplink",
    label: "THE UPLINK",
    eyebrow: "ACT 04 · TRANSMIT",
    title: "The Rooftop Frequency",
    body: "Talks on the roof, mentorship in the threads, alumni on speed dial. NEXUS doesn't end at graduation — it compounds. Ride the beam. Your frequency is next.",
    tags: ["MENTORS", "ALUMNI NET", "YOU"],
    accent: "#4ade80",
    tint: "74,222,128",
    from: { s: 2.3, fx: 0.725, fy: 0.62, r: -0.7 },
    to: { s: 1.14, fx: 0.512, fy: 0.24, r: 0 },
    w: 1.6,
  },
];

/** legacy scene id → act id (old share links keep working) */
const LEGACY_ALIAS: Record<string, string> = {
  community: "uplink",
  nexus: "overwatch",
};

function actIndexFromId(id: string): number {
  const resolved = LEGACY_ALIAS[id] ?? id;
  return ACTS.findIndex((a) => a.id === resolved);
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
/** plateau ease — dwell 12% at each end of an act so keyframes read */
function plateau(u: number) {
  return easeInOut(clamp01((u - 0.12) / 0.76));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Segment {
  act: Act;
  idx: number;
  w: number;
}

/** Absolute document-Y that centres act `idx` mid-scrub. */
function actTop(outer: HTMLElement, segments: Segment[], idx: number, vh: number): number {
  const docTop = outer.getBoundingClientRect().top + window.scrollY;
  let acc = 0;
  for (let i = 0; i < idx; i++) acc += segments[i].w * vh;
  return docTop + acc + segments[idx].w * vh * 0.55;
}

/** "#scene-lab" (or legacy "#scene-community") → act index, or -1. */
function actFromHash(hash: string): number {
  const m = /^#scene-([a-z-]+)$/.exec(hash);
  if (!m) return -1;
  return actIndexFromId(m[1]);
}

/** "?scene=lab" → act index, or -1 (share links carry the OG preview). */
function actFromQuery(): number {
  if (typeof window === "undefined") return -1;
  const v = new URLSearchParams(window.location.search).get("scene");
  if (!v) return -1;
  return actIndexFromId(v);
}

export function ScrollFlight() {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement | null>(null);
  const letterTopRef = useRef<HTMLDivElement | null>(null);
  const letterBotRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const teleRef = useRef<HTMLSpanElement | null>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [sweepKey, setSweepKey] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const mounted = useMounted();
  const didHashJump = useRef(false);
  const activeIdxRef = useRef(0);
  const { toast } = useToast();

  const segments = useMemo<Segment[]>(() => ACTS.map((act, idx) => ({ act, idx, w: act.w })), []);
  const totalW = useMemo(() => segments.reduce((a, s) => a + s.w, 0), [segments]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setImgReady(true);
        window.clearInterval(id);
      }
    }, 180);
    const stop = window.setTimeout(() => window.clearInterval(id), 12000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const img = imgRef.current;
    if (!outer || !sticky || !img) return;

    let raf = 0;
    let visible = true;
    let Dpx = 1;
    let pRaw = 0; // scroll-derived progress target
    let lastP = 0;
    let lastT = performance.now();
    let spd = 0;
    let lastAppliedP = -1; // convergence guard: skip DOM writes when settled

    // Lenis-style camera state — glides toward the scroll pose every frame
    const cur = { s: ACTS[0].from.s, tx: 0, ty: 0, r: 0 };
    let initialized = false;

    const measure = () => {
      const vh = window.innerHeight;
      Dpx = Math.max(1, totalW * vh);
      outer.style.height = `${Dpx + vh}px`;
    };

    /** pose for absolute progress p — continuous across act boundaries */
    const poseAt = (p: number) => {
      const D = clamp01(p) * Dpx;
      const vh = window.innerHeight;
      let acc = 0;
      let segIdx = segments.length - 1;
      let u = 1;
      for (let i = 0; i < segments.length; i++) {
        const segW = segments[i].w * vh;
        if (D < acc + segW || i === segments.length - 1) {
          segIdx = i;
          u = clamp01((D - acc) / segW);
          break;
        }
        acc += segW;
      }
      const act = segments[segIdx].act;
      const e = plateau(u);
      const s = lerp(act.from.s, act.to.s, e);
      const fx = lerp(act.from.fx, act.to.fx, e);
      const fy = lerp(act.from.fy, act.to.fy, e);
      const r = lerp(act.from.r, act.to.r, e);
      return { segIdx, u, s, fx, fy, r };
    };

    const update = () => {
      const vh = window.innerHeight;
      const rect = outer.getBoundingClientRect();
      pRaw = clamp01(-rect.top / Dpx);

      // scroll velocity → HUD speed readout (px/s of progress, smoothed)
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastT) / 1000);
      lastT = now;
      const inst = Math.abs(pRaw - lastP) * Dpx / dt;
      lastP = pRaw;
      spd = lerp(spd, inst, 0.12);

      const target = poseAt(pRaw);
      // focal point → translate %; clamp keeps the frame covered (no edges)
      let tx = (0.5 - target.fx) * 100;
      let ty = (0.5 - target.fy) * 100;
      const maxT = Math.max(0, target.s - 1) * 50 * 0.8;
      tx = Math.max(-maxT, Math.min(maxT, tx));
      ty = Math.max(-maxT, Math.min(maxT, ty));

      if (!initialized) {
        cur.s = target.s;
        cur.tx = tx;
        cur.ty = ty;
        cur.r = target.r;
        initialized = true;
      }

      // the Lenis trick — exponential glide toward the pose
      const a = 0.11;
      cur.s = lerp(cur.s, target.s, a);
      cur.tx = lerp(cur.tx, tx, a);
      cur.ty = lerp(cur.ty, ty, a);
      cur.r = lerp(cur.r, target.r, a);

      // convergence guard — once the camera has settled on the current
      // pose AND scroll hasn't moved, skip all DOM writes (idle battery)
      const delta =
        Math.abs(cur.s - target.s) +
        Math.abs(cur.tx - tx) +
        Math.abs(cur.ty - ty) +
        Math.abs(cur.r - target.r);
      const settled = delta < 0.0006 && pRaw === lastAppliedP;
      lastAppliedP = pRaw;
      if (settled && initialized) return;

      // camera-out: rotate outermost so coverage math stays valid
      img.style.transform = `rotate(${cur.r.toFixed(3)}deg) scale(${cur.s.toFixed(4)}) translate3d(${cur.tx.toFixed(3)}%, ${cur.ty.toFixed(3)}%, 0)`;

      // copy overlays
      for (let i = 0; i < segments.length; i++) {
        const copy = copyRefs.current[i];
        if (!copy) continue;
        let op = 0;
        if (i === target.segIdx) {
          const { u } = target;
          const cIn = clamp01((u - 0.14) / 0.2);
          const cOut = i === segments.length - 1 ? 1 : clamp01((0.9 - u) / 0.16);
          op = Math.min(cIn, cOut);
        }
        copy.style.opacity = String(op);
        copy.style.transform = `translateY(${(1 - op) * 26}px)`;
        copy.style.pointerEvents = op > 0.5 ? "auto" : "none";
      }

      // cinema letterbox — eases in once flying, retracts at both ends
      const bar = 4.2 * clamp01(Math.min(pRaw / 0.055, (1 - pRaw) / 0.055));
      if (letterTopRef.current) letterTopRef.current.style.height = `${bar}vh`;
      if (letterBotRef.current) letterBotRef.current.style.height = `${bar}vh`;

      // progress rail
      if (barRef.current) barRef.current.style.transform = `scaleX(${pRaw})`;

      // act bookkeeping: state, hash, readout, sweep trigger
      if (target.segIdx !== activeIdxRef.current) {
        activeIdxRef.current = target.segIdx;
        setActiveIdx(target.segIdx);
        setSweepKey((k) => k + 1);
        const act = segments[target.segIdx].act;
        if (act.id !== "overwatch") {
          const targetHash = `#scene-${act.id}`;
          if (window.location.hash !== targetHash) history.replaceState(null, "", targetHash);
        } else if (/^#scene-/.test(window.location.hash)) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
      // scrubbed back above the flight → drop the scene hash so nav anchors stay clean
      if (rect.top > 0 && /^#scene-/.test(window.location.hash)) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      // HUD readouts
      if (readoutRef.current) {
        const act = segments[target.segIdx].act;
        readoutRef.current.textContent =
          act.id === "overwatch"
            ? `APPROACH VECTOR · CAMERA ENGAGED · ${String(Math.round(pRaw * 100)).padStart(3, "0")}%`
            : `ACT ${String(actIndexFromId(act.id)).padStart(2, "0")}/04 — ${act.label.toUpperCase()} · ${String(Math.round(pRaw * 100)).padStart(3, "0")}%`;
      }
      if (teleRef.current) {
        // fun-but-honest telemetry derived from the real camera numbers
        const az = (-cur.tx * 0.62).toFixed(1).padStart(5);
        const el = (cur.ty * 0.45).toFixed(1).padStart(5);
        const alt = Math.round(1450 / cur.s);
        const tSec = pRaw * 42;
        const mm = String(Math.floor(tSec / 60)).padStart(2, "0");
        const ss = String(Math.floor(tSec % 60)).padStart(2, "0");
        const ff = String(Math.floor((tSec % 1) * 24)).padStart(2, "0");
        teleRef.current.textContent = `AZ ${az}°  EL ${el}°  ALT ${alt}M  SPD ${String(Math.round(Math.min(999, spd * 0.9))).padStart(3, "0")}U/S  TC T+${mm}:${ss}:${ff}`;
      }
    };

    // rAF loop — runs while the flight is near the viewport; the lerp
    // keeps animating after scroll stops until the camera settles
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      update();
    };

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
      rootMargin: "60% 0px",
    });
    io.observe(outer);

    // deep link landing (#scene-lab / ?scene=lab — ?scene is promoted to
    // the canonical hash first; legacy community/nexus ids still land)
    const fromQuery = actFromQuery();
    if (fromQuery >= 0 && actFromHash(window.location.hash) < 0) {
      const rest = new URLSearchParams(window.location.search);
      const actId = LEGACY_ALIAS[rest.get("scene")!] ?? rest.get("scene")!;
      rest.delete("scene");
      const qs = rest.toString();
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}#scene-${actId}`
      );
    }
    const initialAi = didHashJump.current ? -1 : Math.max(actFromHash(window.location.hash), fromQuery);
    didHashJump.current = true;

    const landDeepLink = (segIdx: number) => {
      measure();
      window.scrollTo({ top: actTop(outer, segments, segIdx, window.innerHeight), behavior: "instant" });
      update();
    };

    measure();
    update();

    if (initialAi >= 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => landDeepLink(initialAi)));
      // re-land on a short loop until the target converges with reality
      let userMoved = false;
      const markMoved = () => (userMoved = true);
      window.addEventListener("wheel", markMoved, { passive: true });
      window.addEventListener("touchmove", markMoved, { passive: true });
      window.addEventListener("keydown", markMoved, { passive: true });
      const settle = setInterval(() => {
        if (userMoved) return flightCleanup();
        const t = actTop(outer, segments, initialAi, window.innerHeight);
        if (Math.abs(t - window.scrollY) < 2) return flightCleanup();
        landDeepLink(initialAi);
      }, 120);
      const stop = setTimeout(flightCleanup, 2500);
      function flightCleanup() {
        clearInterval(settle);
        clearTimeout(stop);
        window.removeEventListener("wheel", markMoved);
        window.removeEventListener("touchmove", markMoved);
        window.removeEventListener("keydown", markMoved);
      }
    }

    // keys 0–4 jump between acts (0 = overwatch approach)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!/^[0-4]$/.test(e.key)) return;
      const idx = Number(e.key);
      if (idx >= segments.length) return;
      window.scrollTo({ top: actTop(outer, segments, idx, window.innerHeight), behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);

    const onResize = () => {
      measure();
      update();
    };
    // no scroll listener needed: update() re-reads the scroll rect inside
    // the rAF tick, and the lerp keeps gliding after scroll stops
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      io.disconnect();
    };
  }, [segments, totalW]);

  const jumpToAct = (idx: number) => {
    const outer = outerRef.current;
    if (!outer) return;
    window.scrollTo({
      top: actTop(outer, segments, idx, window.innerHeight),
      behavior: "smooth",
    });
  };

  const copyActLink = (actId: string) => {
    const shareId = actId === "overwatch" ? "nexus" : actId;
    const url = `${window.location.origin}${window.location.pathname}?scene=${shareId}`;
    const done = () =>
      toast({
        title: "FLIGHT LINK COPIED",
        description: `?scene=${shareId} — lands mid-shot on this act, previews its own card.`,
      });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        toast({ title: "CLIPBOARD BLOCKED", description: url, variant: "destructive" });
      });
    } else {
      toast({ title: "CLIPBOARD BLOCKED", description: url, variant: "destructive" });
    }
  };

  // reduced motion: stacked act cards, each a different crop of the one shot
  if (mounted && reducedMotion) {
    return (
      <section id="flight" className="relative border-y border-border/60 bg-[#060a07]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">01 / THE FLIGHT</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            One city block. One shot.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            A single continuous pass over the NEXUS world — presented as five stills
            (reduced motion).
          </p>
        </div>
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
          {ACTS.map((a, i) => (
            <article key={a.id} className="hud-corners relative overflow-hidden rounded-md border border-border">
              <img
                src={WORLD}
                alt={a.title}
                className="h-72 w-full object-cover sm:h-96"
                style={{ objectPosition: `${a.to.fx * 100}% ${a.to.fy * 100}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050806] via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 max-w-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: a.accent }}>
                  {a.eyebrow}
                </p>
                <h3 className="font-display mt-2 text-2xl font-bold text-foreground">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
              </div>
              <span className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground">
                {String(i).padStart(2, "0")}/04
              </span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="flight" className="relative">
      <div ref={outerRef} style={{ height: `${totalW * 100}vh` }} data-qa="flight-outer">
        <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-[#040705]">
          {/* ---------- the one shot ---------- */}
          <img
            ref={imgRef}
            src={WORLD}
            alt="Aerial night view of the NEXUS world — a glowing miniature tech-campus diorama"
            fetchPriority="high"
            decoding="async"
            onLoad={() => setImgReady(true)}
            className={`h-full w-full object-cover will-change-transform transition-opacity duration-700 ${imgReady ? "opacity-100" : "opacity-0"}`}
          />
          {/* the shot often finishes loading BEFORE hydration attaches the
              onLoad listener — this effect polls `complete` so the fade-in
              can never strand at opacity 0 (QA-caught) */}

          {/* per-act color grade (crossfades with the act) */}
          {ACTS.map((a, i) => (
            <div
              key={`tint-${a.id}`}
              className="pointer-events-none absolute inset-0 transition-opacity duration-700"
              style={{
                opacity: activeIdx === i ? 0.14 : 0,
                background: `radial-gradient(ellipse at 50% 42%, transparent 38%, rgba(${a.tint},0.55) 100%)`,
                mixBlendMode: "overlay",
              }}
            />
          ))}

          {/* act-change light sweep */}
          {sweepKey > 0 && (
            <div key={sweepKey} className="flight-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
          )}

          {/* ---------- HUD ---------- */}
          <div className="grain pointer-events-none absolute inset-0" />
          <div className="scanlines pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(4,7,5,0.55)_100%)]" />

          {/* cinema letterbox */}
          <div ref={letterTopRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-black" style={{ height: "0vh" }} />
          <div ref={letterBotRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black" style={{ height: "0vh" }} />

          {/* top readout */}
          <div className="pointer-events-none absolute left-4 top-16 z-10 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-primary/80 sm:left-8">
            <span className="led" />
            <span ref={readoutRef}>APPROACH VECTOR · CAMERA ENGAGED · 000%</span>
          </div>

          {/* telemetry (desktop) */}
          <div className="pointer-events-none absolute right-4 top-16 z-10 hidden font-mono text-[9px] tracking-[0.18em] text-primary/45 md:block md:right-8">
            <span ref={teleRef}>AZ 0.0°  EL 0.0°  ALT 1422M  SPD 000U/S  TC T+00:00:00</span>
          </div>

          {/* act rail */}
          <div className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-3 sm:flex md:right-8">
            {segments.map((seg, i) => {
              const active = activeIdx === i;
              return (
                <button
                  key={seg.act.id}
                  onClick={() => jumpToAct(i)}
                  className="group flex items-center gap-2 font-mono text-[9px] tracking-[0.25em] transition-colors"
                  aria-label={`Jump to act ${i} — ${seg.act.label}`}
                  aria-current={active ? "true" : undefined}
                >
                  <span className={`tabular-nums ${active ? "text-primary/90" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`}>
                    {String(i).padStart(2, "0")}
                  </span>
                  <span className={active ? "text-primary text-glow" : "text-muted-foreground/60 group-hover:text-foreground"}>
                    {seg.act.label}
                  </span>
                  <span
                    className={`block h-px transition-all duration-300 ${
                      active ? "w-8 bg-primary shadow-[0_0_8px_rgba(74,222,128,0.9)]" : "w-4 bg-border group-hover:w-6"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* copy overlays */}
          {ACTS.map((a, i) => (
            <div
              key={`copy-${a.id}`}
              ref={(el) => {
                copyRefs.current[i] = el;
              }}
              className="absolute inset-x-0 bottom-0 z-10 pb-24 pt-40 sm:pb-28"
              style={{ opacity: i === 0 ? undefined : 0 }}
            >
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="max-w-2xl">
                  <p className="font-mono text-[10px] tracking-[0.35em] sm:text-[11px]" style={{ color: a.accent }}>
                    {a.eyebrow}
                  </p>
                  <h3 className="font-display mt-3 text-4xl font-bold leading-[1.02] tracking-tight text-foreground text-glow sm:text-6xl">
                    {a.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base">{a.body}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-sm border border-border/80 bg-black/40 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-foreground/70 backdrop-blur-sm"
                      >
                        {t}
                      </span>
                    ))}
                    <button
                      onClick={() => copyActLink(a.id)}
                      title="copy a deep link to this act"
                      aria-label={`Copy deep link to act ${a.label}`}
                      className="flex items-center gap-1.5 rounded-sm border border-border/80 bg-black/40 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <Link2 className="h-3 w-3" />
                      LINK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* bottom progress */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-black/50">
            <div
              ref={barRef}
              className="h-full origin-left bg-gradient-to-r from-primary to-amber-300"
              style={{ transform: "scaleX(0)" }}
            />
          </div>

          {/* keys hint + engine credit */}
          <div className="pointer-events-none absolute bottom-3 right-4 z-10 hidden items-center gap-4 font-mono text-[8px] tracking-[0.2em] text-muted-foreground/50 sm:flex sm:right-8">
            <span>KEYS 0–4 JUMP ACTS</span>
            <span>ONE SHOT · LETS-SCROLL (ADAPTED)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
