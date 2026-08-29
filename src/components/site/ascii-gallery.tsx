"use client";

import { AsciiImage } from "@/components/ascii/ascii-image";
import { useReveal } from "@/components/site/use-reveal";

const SHOTS = [
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
    label: "WINState.RAW",
    caption: "A team of students celebrating with a trophy on stage",
  },
];

export function AsciiGallery() {
  const { ref, seen } = useReveal<HTMLDivElement>();

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
              SWITCH MODES OR BLEND THE SLIDER. ENGINE: ASCILINE-STYLE MAPPER.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SHOTS.map((s) => (
              <AsciiImage key={s.src} {...s} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
