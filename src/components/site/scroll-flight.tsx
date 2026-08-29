"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * ScrollFlight — a scroll-scrubbed camera flight through the NEXUS world.
 *
 * This is an adaptation of the lets-scroll scrub-engine
 * (https://github.com/AIwithhassan/lets-scroll): the scroll position never
 * cuts — it moves time along one continuous camera path. Each scene is a
 * segment with its own virtual camera (scale + pan), and consecutive scenes
 * dissolve across a fixed seam width so the flight reads as a single shot.
 * A blob-loaded, always-seekable intro clip (frame-locked fly-through) is
 * scrubbed with coalesced seeks exactly like the original engine.
 */

interface SceneDef {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  tags: string[];
  still: string;
  accent: string;
  cam: { s0: number; s1: number; x0: number; x1: number; y0: number; y1: number };
}

const SCENES: SceneDef[] = [
  {
    id: "gate",
    label: "THE GATE",
    eyebrow: "SCENE 01 · ARRIVAL",
    title: "The Campus Grid",
    body: "Every build starts here. One plaza, five domains, hundreds of students routing energy into the same network — welcome to the NEXUS node.",
    tags: ["COMMUNITY", "VIT CHENNAI", "EST. 2019"],
    still: "/media/scene-gate.png",
    accent: "#4ade80",
    cam: { s0: 1.22, s1: 1.02, x0: -2.2, x1: 0, y0: 1.4, y1: -1 },
  },
  {
    id: "lab",
    label: "THE LAB",
    eyebrow: "SCENE 02 · RESEARCH",
    title: "Where Prototypes Breathe",
    body: "Robotics bays, GPU boxes and a soldering bench that never sleeps. This is where 2 a.m. ideas get chassis, firmware and a demo video.",
    tags: ["ROBOTICS", "AI/ML", "IOT"],
    still: "/media/scene-lab.png",
    accent: "#a7f3d0",
    cam: { s0: 1.04, s1: 1.22, x0: 0, x1: -2.6, y0: -1, y1: 1.2 },
  },
  {
    id: "build",
    label: "THE BUILD",
    eyebrow: "SCENE 03 · SHIP IT",
    title: "36 Hours. One Shot.",
    body: "Hack nights are our heartbeat — desks glow, repos multiply, and by sunrise something exists that didn't yesterday. Demo or it didn't happen.",
    tags: ["HACKATHON", "OPEN SOURCE", "SHIPPING"],
    still: "/media/scene-build.png",
    accent: "#fbbf24",
    cam: { s0: 1.18, s1: 1.0, x0: 2.4, x1: 0, y0: -0.8, y1: 0.8 },
  },
  {
    id: "community",
    label: "THE UPLINK",
    eyebrow: "SCENE 04 · TRANSMIT",
    title: "The Rooftop Frequency",
    body: "Talks on the roof, mentorship in the threads, alumni on speed dial. NEXUS doesn't end at graduation — it compounds. Your frequency is next.",
    tags: ["MENTORS", "ALUMNI NET", "YOU"],
    still: "/media/scene-community.png",
    accent: "#4ade80",
    cam: { s0: 1.0, s1: 1.2, x0: 0, x1: 2.4, y0: 0.6, y1: -1.4 },
  },
];

const SEAM = 0.16; // crossfade width as fraction of a segment (seam dissolve)

interface Segment {
  kind: "video" | "still";
  scene: SceneDef;
  w: number; // weight in viewport-heights
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Absolute document-Y that centres segment `idx` mid-scrub. */
function segmentTop(
  outer: HTMLElement,
  segments: Segment[],
  idx: number,
  vh: number
): number {
  // rect-based (offsetTop is 0 here — the section is the offsetParent)
  const docTop = outer.getBoundingClientRect().top + window.scrollY;
  let acc = 0;
  for (let i = 0; i < idx; i++) acc += segments[i].w * vh;
  return docTop + acc + segments[idx].w * vh * 0.55;
}

/** "#scene-lab" → scene index, or -1. */
function sceneFromHash(hash: string): number {
  const m = /^#scene-([a-z-]+)$/.exec(hash);
  if (!m) return -1;
  return SCENES.findIndex((s) => s.id === m[1]);
}

export function ScrollFlight({ hasIntroVideo }: { hasIntroVideo: boolean }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPosterRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);

  const [activeIdx, setActiveIdx] = useState(hasIntroVideo ? -1 : 0);
  const [videoState, setVideoState] = useState<"idle" | "loading" | "ready" | "failed">(
    hasIntroVideo ? "idle" : "failed"
  );
  const activeIdxRef = useRef(activeIdx);
  const videoStateRef = useRef(videoState);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const didHashJump = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // prewarm the scene stills so seams stay seamless on first scrub
    const warm = (src: string) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    };
    const id = setTimeout(() => SCENES.forEach((s) => warm(s.still)), 1200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    videoStateRef.current = videoState;
  }, [videoState]);

  const segments = useMemo<Segment[]>(() => {
    const segs: Segment[] = [];
    if (hasIntroVideo) {
      segs.push({ kind: "video", scene: SCENES[0], w: 1.6 });
    }
    SCENES.forEach((s, i) => {
      segs.push({ kind: "still", scene: s, w: i === SCENES.length - 1 ? 1.5 : 1.3 });
    });
    if (!hasIntroVideo) {
      // still-only mode: give first scene a little more dwell
      segs[0].w = 1.5;
    }
    return segs;
  }, [hasIntroVideo]);

  const totalW = useMemo(() => segments.reduce((a, s) => a + s.w, 0), [segments]);

  // layer count = segments (one visual layer per segment; video uses its own layer)
  const layerCount = segments.length;

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    if (!outer || !sticky) return;

    let raf = 0;
    let ticking = false;
    let Dpx = 1;

    const measure = () => {
      const vh = window.innerHeight;
      Dpx = Math.max(1, totalW * vh);
      outer.style.height = `${Dpx + vh}px`;
    };

    // ---------- video blob loading (always seekable, like the engine) ----------
    let pendingSeek: number | null = null;
    const video = videoRef.current;

    const primeVideo = async () => {
      if (!video || videoState !== "idle") return;
      setVideoState("loading");
      try {
        const res = await fetch("/media/hero-flight.mp4");
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        video.src = url;
        video.preload = "auto";
        video.addEventListener("loadeddata", () => {
          setVideoState("ready");
          // re-run the scrub so the segment seeks to the current scroll position
          window.dispatchEvent(new Event("scroll"));
        }, { once: true });
        video.addEventListener("error", () => setVideoState("failed"), { once: true });
      } catch {
        setVideoState("failed");
      }
    };

    const onSeeked = () => {
      const v = videoRef.current;
      if (!v || pendingSeek == null) return;
      if (Math.abs(pendingSeek - v.currentTime) > 0.04) {
        v.currentTime = pendingSeek;
        pendingSeek = null;
      }
    };
    video?.addEventListener("seeked", onSeeked);

    // start loading when the flight is near
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          primeVideo();
          io.disconnect();
        }
      },
      { rootMargin: "120% 0px" }
    );
    io.observe(outer);

    // ---------- the scrub ----------
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = outer.getBoundingClientRect();
      const scrolled = clamp01(-rect.top / Dpx);
      const D = scrolled * Dpx; // px travelled inside the flight

      // find segment + local u
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

      for (let i = 0; i < layerCount; i++) {
        const layer = layerRefs.current[i];
        const copy = copyRefs.current[i];
        if (!layer) continue;
        const seg = segments[i];

        // base opacity: only current segment visible, seam crossfade both sides
        let op = 0;
        if (i === segIdx) {
          const fin = i > 0 ? clamp01(u / SEAM) : 1;
          const fout = i < layerCount - 1 ? clamp01((1 - u) / SEAM) : 1;
          op = Math.min(fin, fout);
        } else if (i === segIdx - 1 && u < SEAM) {
          op = clamp01(1 - u / SEAM); // outgoing layer during seam
        }

        // camera
        const e = easeInOut(u);
        const { s0, s1, x0, x1, y0, y1 } = seg.scene.cam;
        const drift = seg.kind === "video" ? 1.6 : 1;
        const scale = s0 + (s1 - s0) * e;
        const tx = (x0 + (x1 - x0) * e) * drift;
        const ty = (y0 + (y1 - y0) * e) * drift;

        if (seg.kind === "video") {
          // poster handles the camera move; video sits cover on top when ready
          if (videoPosterRef.current) {
            videoPosterRef.current.style.transform = `scale(${scale}) translate3d(${tx}%, ${ty}%, 0)`;
          }
          if (video && videoStateRef.current === "ready") {
            const dur = video.duration || 5;
            const target = Math.max(0, Math.min(dur - 0.05, u * dur));
            if (video.seeking) {
              pendingSeek = target;
            } else if (Math.abs(video.currentTime - target) > 0.045) {
              video.currentTime = target;
            }
          }
        } else {
          const img = layer.querySelector("img");
          if (img) img.style.transform = `scale(${scale}) translate3d(${tx}%, ${ty}%, 0)`;
        }

        layer.style.opacity = String(op);
        layer.style.visibility = op <= 0.001 ? "hidden" : "visible";

        // copy drift: fade in as segment settles, drift up
        if (copy) {
          const cIn = clamp01((u - 0.12) / 0.22);
          const cOut = i === layerCount - 1 ? 1 : clamp01((0.92 - u) / 0.14);
          const cop = Math.min(cIn, cOut) * (op > 0.4 ? 1 : op * 2);
          copy.style.opacity = String(clamp01(cop));
          copy.style.transform = `translateY(${(1 - clamp01(cop)) * 26}px)`;
          copy.style.pointerEvents = cop > 0.5 ? "auto" : "none";
        }
      }

      // readouts
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${scrolled})`;
      }
      const nextIdx = segIdx - (hasIntroVideo ? 1 : 0);
      if (nextIdx !== activeIdxRef.current) {
        activeIdxRef.current = nextIdx;
        setActiveIdx(nextIdx);
        // keep the URL in sync so any scene is deep-linkable (#scene-lab)
        const curSeg = segments[segIdx];
        if (curSeg.kind === "still") {
          const target = `#scene-${curSeg.scene.id}`;
          if (window.location.hash !== target) {
            history.replaceState(null, "", target);
          }
        }
      }
      // scrubbed back above the flight → drop the scene hash so nav anchors stay clean
      if (rect.top > 0 && /^#scene-/.test(window.location.hash)) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      if (readoutRef.current) {
        const seg = segments[segIdx];
        const sceneNo = segIdx - (hasIntroVideo ? 1 : 0);
        readoutRef.current.textContent =
          seg.kind === "video"
            ? "FLY-IN · CAMERA ENGAGED"
            : `SCENE ${String(sceneNo + 1).padStart(2, "0")}/${String(SCENES.length).padStart(2, "0")} — ${seg.scene.label}`;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    // deep link: #scene-lab lands mid-scrub on that scene, instantly.
    // Capture the hash BEFORE update() runs — the scrub's "above flight"
    // branch strips unknown-to-the-DOM hashes on the very first frame.
    const initialSi = didHashJump.current ? -1 : sceneFromHash(window.location.hash);
    didHashJump.current = true;

    const landDeepLink = (segIdx2: number) => {
      measure();
      window.scrollTo({
        top: segmentTop(outer, segments, segIdx2, window.innerHeight),
        behavior: "instant",
      });
      update();
    };

    measure();
    update();

    if (initialSi >= 0) {
      const segIdx2 = initialSi + (hasIntroVideo ? 1 : 0);
      // two frames out — past the browser's own initial scroll handling;
      // "instant" overrides the global scroll-behavior:smooth so the
      // landing can't be cancelled mid-animation
      requestAnimationFrame(() => requestAnimationFrame(() => landDeepLink(segIdx2)));
      // fonts/images above us settle late and shift the flight's document
      // offset → re-land on a short loop until the target converges with
      // reality (any user input hands control back immediately)
      let userMoved = false;
      const markMoved = () => {
        userMoved = true;
      };
      window.addEventListener("wheel", markMoved, { passive: true });
      window.addEventListener("touchmove", markMoved, { passive: true });
      window.addEventListener("keydown", markMoved, { passive: true });
      const settle = setInterval(() => {
        if (userMoved) {
          clearInterval(settle);
          cleanup();
          return;
        }
        const target = segmentTop(outer, segments, segIdx2, window.innerHeight);
        if (Math.abs(target - window.scrollY) < 2) {
          clearInterval(settle);
          cleanup();
          return;
        }
        landDeepLink(segIdx2);
      }, 120);
      const stop = setTimeout(() => {
        clearInterval(settle);
        cleanup();
      }, 2500);
      const cleanup = () => {
        clearTimeout(stop);
        window.removeEventListener("wheel", markMoved);
        window.removeEventListener("touchmove", markMoved);
        window.removeEventListener("keydown", markMoved);
      };
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      video?.removeEventListener("seeked", onSeeked);
    };
  }, [segments, layerCount, totalW, hasIntroVideo]);

  const jumpToSegment = (idx: number, smooth = true) => {
    const vh = window.innerHeight;
    const outer = outerRef.current;
    if (!outer) return;
    const top = segmentTop(outer, segments, idx, vh);
    window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  };

  const copySceneLink = (sceneId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#scene-${sceneId}`;
    const done = () =>
      toast({
        title: "SCENE LINK COPIED",
        description: `#${sceneId} — anyone opening this lands mid-flight on this shot.`,
      });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        toast({ title: "CLIPBOARD BLOCKED", description: url, variant: "destructive" });
      });
    } else {
      toast({ title: "CLIPBOARD BLOCKED", description: url, variant: "destructive" });
    }
  };

  // reduced motion: stacked panels (client-only to avoid hydration mismatch)
  if (mounted && reducedMotion) {
    return (
      <section id="flight" className="relative border-y border-border/60 bg-[#060a07]">
        <SectionHeader />
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6">
          {SCENES.map((s, i) => (
            <article key={s.id} className="hud-corners relative overflow-hidden rounded-md border border-border">
              <img src={s.still} alt={s.title} className="h-72 w-full object-cover sm:h-96" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050806] via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 max-w-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: s.accent }}>
                  {s.eyebrow}
                </p>
                <h3 className="font-display mt-2 text-2xl font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
              <span className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}/04
              </span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="flight" className="relative">
      <div ref={outerRef} style={{ height: `${totalW * 100}vh` }}>
        <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-[#040705]">
          {/* ---------- layers ---------- */}
          {segments.map((seg, i) => (
            <div
              key={`${seg.kind}-${seg.scene.id}-${i}`}
              ref={(el) => {
                layerRefs.current[i] = el;
              }}
              className="absolute inset-0 will-change-transform"
              style={{ opacity: 0, visibility: "hidden" }}
              aria-hidden={seg.kind === "video"}
            >
              {seg.kind === "video" ? (
                <>
                  <div ref={videoPosterRef} className="absolute inset-0 will-change-transform">
                    <img
                      src={seg.scene.still}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => (e.currentTarget.style.opacity = "0")}
                    />
                  </div>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    playsInline
                    preload="auto"
                    style={{ opacity: videoState === "ready" ? 1 : 0, transition: "opacity 0.5s" }}
                    tabIndex={-1}
                  />
                </>
              ) : (
                <>
                  <img
                    src={seg.scene.still}
                    alt={seg.scene.title}
                    className="h-full w-full object-cover will-change-transform"
                    onError={(e) => (e.currentTarget.style.opacity = "0")}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at 30% 40%, rgba(20,40,24,0.4), rgba(4,7,5,0.9) 80%)",
                    }}
                  />
                </>
              )}

              {/* copy */}
              <div
                ref={(el) => {
                  copyRefs.current[i] = el;
                }}
                className="absolute inset-x-0 bottom-0 pb-24 pt-40 sm:pb-28"
              >
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                  <div className="max-w-2xl">
                    <p
                      className="font-mono text-[10px] tracking-[0.35em] sm:text-[11px]"
                      style={{ color: seg.scene.accent }}
                    >
                      {seg.kind === "video" ? "INCOMING TRANSMISSION · SCROLL TO FLY" : seg.scene.eyebrow}
                    </p>
                    <h3 className="font-display mt-3 text-4xl font-bold leading-[1.02] tracking-tight text-foreground text-glow sm:text-6xl">
                      {seg.kind === "video" ? "Fly the NEXUS world" : seg.scene.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base">
                      {seg.kind === "video"
                        ? "One continuous shot — your scroll is the camera throttle. Dissolve through four scenes of the collective."
                        : seg.scene.body}
                    </p>
                    {seg.kind === "still" && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {seg.scene.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-sm border border-border/80 bg-black/40 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-foreground/70 backdrop-blur-sm"
                          >
                            {t}
                          </span>
                        ))}
                        <button
                          onClick={() => copySceneLink(seg.scene.id)}
                          title="copy a deep link to this scene"
                          aria-label={`Copy deep link to scene ${seg.scene.label}`}
                          className="flex items-center gap-1.5 rounded-sm border border-border/80 bg-black/40 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <Link2 className="h-3 w-3" />
                          LINK
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ---------- HUD ---------- */}
          <div className="grain pointer-events-none absolute inset-0" />
          <div className="scanlines pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(4,7,5,0.5)_100%)]" />

          {/* top readout */}
          <div className="pointer-events-none absolute left-4 top-16 z-10 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-primary/80 sm:left-8">
            <span className="led" />
            <span ref={readoutRef}>FLY-IN · CAMERA ENGAGED</span>
          </div>

          {/* segment rail */}
          <div className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-3 sm:flex md:right-8">
            {segments.map((seg, i) => {
              const sceneNo = i - (hasIntroVideo ? 1 : 0);
              const label = seg.kind === "video" ? "FLY-IN" : seg.scene.label;
              const active = activeIdx === sceneNo;
              return (
                <button
                  key={i}
                  onClick={() => jumpToSegment(i)}
                  className="group flex items-center gap-2 font-mono text-[9px] tracking-[0.25em] transition-colors"
                  aria-label={`Jump to ${label}`}
                >
                  <span className={active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"}>
                    {label}
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

          {/* bottom progress */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-black/50">
            <div
              ref={barRef}
              className="h-full origin-left bg-gradient-to-r from-primary to-amber-300"
              style={{ transform: "scaleX(0)" }}
            />
          </div>

          {/* engine credit */}
          <div className="pointer-events-none absolute bottom-3 right-4 z-10 font-mono text-[8px] tracking-[0.2em] text-muted-foreground/50 sm:right-8">
            SCRUB ENGINE · LETS-SCROLL (ADAPTED)
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <p className="font-mono text-[11px] tracking-[0.3em] text-primary">01 / THE FLIGHT</p>
      <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
        Fly the NEXUS world
      </h2>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
        A scroll-scrubbed camera flight — one continuous shot through our world.
      </p>
    </div>
  );
}
