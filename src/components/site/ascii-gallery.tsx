"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AsciiImage } from "@/components/ascii/ascii-image";
import { AsciiCamFeed } from "@/components/ascii/ascii-camfeed";
import { AsciiLightbox, type LightboxShot } from "@/components/ascii/ascii-lightbox";
import { useReveal } from "@/components/site/use-reveal";
import { buildFrameDeepLink, replaceUrl } from "@/lib/deep-link";
import type { AsciiMode } from "@/lib/ascii";

const SHOTS: LightboxShot[] = [
  {
    src: "/media/gallery-1.jpg",
    label: "EXPO_BOOTH.RAW",
    caption: "Students gathering at a club booth to collect stickers and connect with members",
  },
  {
    src: "/media/gallery-2.jpg",
    label: "BUILD_NIGHT.RAW",
    caption: "A packed house of student teams hacking and prototyping projects live at Nexathon '25",
  },
  {
    src: "/media/gallery-3.jpg",
    label: "CODE_NEXUS.RAW",
    caption: "High-focus moments as students optimize data structures and code under time constraints",
  },
  {
    src: "/media/gallery-4.jpeg",
    label: "NEXUS_COMMUNITY.RAW",
    caption: "The crew behind the scenes celebrating after executing another campus event",
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
  // the lightbox carries the expanding card's render state so the extended
  // view opens exactly where the card was (mode/mix continuity)
  const [lightbox, setLightbox] = useState<{
    index: number;
    mode: AsciiMode;
    mix: number;
  } | null>(null);
  // guards the StrictMode double-run of the deep-link effect
  const linked = useRef(false);

  // deep link: /…#frame-N lands directly on that frame's lightbox
  useEffect(() => {
    if (linked.current) return;
    const idx = frameFromHash();
    if (idx == null) return;
    document.getElementById("gallery")?.scrollIntoView({ behavior: "instant" });
    // defer past the jump's scroll event, then open the lightbox and
    // re-assert the hash
    const id = window.setTimeout(() => {
      linked.current = true;
      setLightbox({ index: idx, mode: "photo", mix: 50 });
      replaceUrl(buildFrameDeepLink(idx + 1));
    }, 160);
    return () => {
      // StrictMode's simulated remount tears this timer down before it can
      // fire - the effect re-run must be allowed to schedule it again, so
      // only clear while the opener has not yet fired.
      if (!linked.current) window.clearTimeout(id);
    };
  }, []);

  // keep the hash in sync with the open frame; strip it when closed.
  // `init` rides along only on card EXPAND - arrow-key navigation keeps
  // whatever mode/blend the viewer already had.
  const openFrame = useCallback(
    (i: number, init?: { mode: AsciiMode; mix: number }) => {
      setLightbox((prev) => ({
        index: i,
        mode: init?.mode ?? prev?.mode ?? "photo",
        mix: init?.mix ?? prev?.mix ?? 50,
      }));
      replaceUrl(buildFrameDeepLink(i + 1));
    },
    []
  );

  const closeFrame = useCallback(() => {
    setLightbox(null);
    replaceUrl(`${window.location.pathname}${window.location.search}`);
  }, []);

  return (
    <section id="gallery" className="relative border-b border-border/60 bg-[#070b14]">
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
              EVERY FRAME IS RENDERED AS TEXT - NO CODEC, NO GPU, JUST GLYPHS.
              SWITCH MODES, BLEND THE SLIDER, DUMP OR PRINT ANY FRAME (.TXT / .PNG),
              OR GO LIVE: PIPE YOUR OWN CAMERA THROUGH THE ENGINE AND CAPTURE THE
              GLYPHS. CLICK A FRAME FOR THE FULL-RES TERMINAL VIEW - EACH ONE HAS A
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
                onExpand={(state) => openFrame(i, state)}
              />
            ))}
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <AsciiLightbox
          shots={SHOTS}
          index={lightbox.index}
          initialMode={lightbox.mode}
          initialMix={lightbox.mix}
          onClose={closeFrame}
          onNavigate={(next) => openFrame(next)}
          deepLink={(i) => buildFrameDeepLink(i + 1)}
        />
      )}
    </section>
  );
}
