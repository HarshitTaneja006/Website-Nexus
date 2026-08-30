"use client";

import { AsciiCanvas } from "@/components/ascii/ascii-canvas";
import { useReveal } from "@/components/site/use-reveal";

const PILLARS = [
  {
    k: "BUILD_IN_PUBLIC",
    d: "Repos open, demos monthly. If it isn't shipped, it's a sketch.",
  },
  {
    k: "TEACH_FORWARD",
    d: "Every member mentors someone within a semester. Knowledge compounds.",
  },
  {
    k: "ZERO_SPECTATORS",
    d: "Everyone ships something in their first 60 days. That's the only rule.",
  },
];

const DOMAINS = [
  { name: "AI & ML", load: 92 },
  { name: "Web Engineering", load: 88 },
  { name: "Mobile", load: 74 },
  { name: "Cloud & DevOps", load: 81 },
  { name: "Cybersecurity", load: 69 },
];

export function Manifesto() {
  const { ref, seen } = useReveal<HTMLDivElement>();

  return (
    <section id="about" className="relative border-b border-border/60 bg-[#070b08]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:py-28">
        {/* donut panel */}
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""} relative order-2 lg:order-1`}>
          <div className="hud-corners relative overflow-hidden rounded-md border border-border bg-[#050806]">
            <AsciiCanvas preset="donut" className="h-[320px] sm:h-[420px] lg:h-[480px]" fontSize={12} />
            <div className="scanlines absolute inset-0" />
            {/* HUD overlays */}
            <div className="absolute left-3 top-3 font-mono text-[9px] leading-relaxed text-primary/60">
              <p>OBJ: torus.knot</p>
              <p>RENDERER: ascii/32k</p>
            </div>
            <div className="absolute bottom-3 right-3 font-mono text-[9px] text-muted-foreground/70">
              DRAG TO SPIN · ASCILINE HOMAGE
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1.5 font-mono text-[9px] text-primary/80">
              <span className="led" /> LIVE
            </div>
          </div>
        </div>

        {/* copy */}
        <div className={`reveal ${seen ? "is-visible" : ""} order-1 lg:order-2`} style={{ transitionDelay: "90ms" }}>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">02 / MANIFESTO</p>
          <h2 className="font-display mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Not a club.
            <br />
            A <span className="text-glow-amber text-amber-300">compiler</span> for builders.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            NEXUS takes curious students in, runs them through workshops,
            hack nights and real project teams, and outputs engineers who can
            ship. The loop below is our operating system:
          </p>

          <ul className="mt-8 space-y-0">
            {PILLARS.map((p, i) => (
              <li
                key={p.k}
                className="group flex gap-4 border-t border-border/60 py-4 last:border-b transition-colors hover:bg-secondary/30"
              >
                <span className="font-mono text-[10px] text-primary/60 pt-1">0{i + 1}</span>
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.18em] text-foreground group-hover:text-primary">
                    <span className="text-primary/50">$</span> {p.k}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* domain load bars */}
          <div className="mt-8 rounded-md border border-border bg-card/60 p-5">
            <p className="mb-4 flex items-center justify-between font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
              <span>DOMAIN_LOAD.EXE</span>
              <span className="text-primary/60">live</span>
            </p>
            <div className="space-y-3">
              {DOMAINS.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 font-mono text-[11px] text-foreground/80">{d.name}</span>
                  <div className="h-[6px] flex-1 overflow-hidden rounded-sm bg-secondary">
                    <div
                      className="h-full rounded-sm bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-1000 ease-out"
                      style={{ width: seen ? `${d.load}%` : "8%" }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {d.load}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
