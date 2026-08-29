"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AsciiImage } from "@/components/ascii/ascii-image";
import { AsciiCamFeed } from "@/components/ascii/ascii-camfeed";
import { AsciiLightbox, type LightboxShot } from "@/components/ascii/ascii-lightbox";
import { useReveal } from "@/components/site/use-reveal";
import { buildFrameDeepLink, replaceUrl } from "@/lib/deep-link";

const SHOTS: LightboxShot[] = [
  {
    src: "/media/gallery-1.png",
    label: "HACK_NIGHT.RAW",
    caption: "Students coding at long tables during a hackathon night",
  },
  {
    src: "/media/gallery-2.png",
    label: "BENCH_04.RAW",
    caption: "Hands assembling a small robot on a workbench",
  },
  {
    src: "/media/gallery-3.png",
    label: "TALK_S9.RAW",
    caption: "A speaker on stage presenting to a packed auditorium",
  },
  {
    src: "/media/gallery-4.png",
    label: "WIN_STATE.RAW",
    caption: "A team of students celebrating with a trophy on stage",
  },
];

/** Parse `#frame-N` (1-based) → 0-based index, or null. */
function frameFromHash(): number | null {
  if (typeof window === "undefined") return null;
  const m = /^#frame-(\d{1,2})$/.exec(window.location.hash);
  if (!m) return null;
  const idx = Number(m[1]) - 1;
  return idx >= 0 && idx < SHOTS.length ? idx : null;
}

export function AsciiGallery() {
  const { ref, seen } = useReveal<HTMLDivElement>();
  const [lightbox, setLightbox] = useState<number | null>(null);
  // guards the StrictMode double-run of the deep-link effect
  const linked = useRef(false);

  // deep link: /…#frame-N lands directly on that frame's lightbox
  useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    const idx = frameFromHash();
    if (idx == null) return;
    document.getElementById("gallery")?.scrollIntoView({ behavior: "instant" });
    // defer past the jump's scroll event (the flight engine writes #scene-*
    // during the pass-through), then open the lightbox and re-assert the hash
    const id = window.setTimeout(() => {
      setLightbox(idx);
      replaceUrl(buildFrameDeepLink(idx + 1));
    }, 160);
    return () => window.clearTimeout(id);
  }, []);

  // keep the hash in sync with the open frame; strip it when closed
  const openFrame = useCallback((i: number) => {
    setLightbox(i);
    replaceUrl(buildFrameDeepLink(i + 1));
  }, []);

  const closeFrame = useCallback(() => {
    setLightbox(null);
    replaceUrl(`${window.location.pathname}${window.location.search}`);
  }, []);

  return (
    <section id="gallery" className="relative border-b border-border/60 bg-[#070b08]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-primary">06 / GALLERY</p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                ASCII cam feed
              </h2>
            </div>
            <p className="max-w-sm font-mono text-[10px] leading-relaxed tracking-wider text-muted-foreground">
              EVERY FRAME IS RENDERED AS TEXT — NO CODEC, NO GPU, JUST GLYPHS.
              SWITCH MODES, BLEND THE SLIDER, DUMP OR PRINT ANY FRAME (.TXT / .PNG),
              OR GO LIVE: PIPE YOUR OWN CAMERA THROUGH THE ENGINE AND CAPTURE THE
              GLYPHS. CLICK A FRAME FOR THE FULL-RES TERMINAL VIEW — EACH ONE HAS A
              SHAREABLE #frame-N LINK.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AsciiCamFeed />
            </div>
            {SHOTS.map((s, i) => (
              <AsciiImage
                key={s.src}
                {...s}
                onExpand={() => openFrame(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <AsciiLightbox
          shots={SHOTS}
          index={lightbox}
          onClose={closeFrame}
          onNavigate={openFrame}
          deepLink={(i) => buildFrameDeepLink(i + 1)}
        />
      )}
    </section>
  );
}
