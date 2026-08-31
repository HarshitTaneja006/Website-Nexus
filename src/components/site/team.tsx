"use client";

import { Quote } from "lucide-react";
import { useReveal } from "@/components/site/use-reveal";

const CREW = [
  { name: "Rohil Sinha", role: "CHAIRPERSON", line: "Ships the vision, reviews the PRs.", glyph: "RS" },
  { name: "Aryan Kotwal", role: "VICE CHAIRPERSON", line: "Runs the ops grid so builders can build.", glyph: "AK" },
  { name: "Pratik Bhangerwa", role: "GENERAL SECRETARY", line: "Manages operations, governance, and organizational strategy.", glyph: "PB" },
  { name: "Sanchari Das", role: "JOINT SECRETARY", line: "Keeps the records clean and the network connected.", glyph: "SD" },
  { name: "Pranav Anandan", role: "TECH LEAD", line: "Owns the rack, the cluster and the uptime.", glyph: "PA" },
  { name: "Aakar Gupta", role: "EVENTS LEAD", line: "Turns spreadsheets into 200-person rooms.", glyph: "AG" },
  { name: "Aditya Kumar Sharma", role: "PROJECTS LEAD", line: "Architects project roadmaps and drives shipping deliverables.", glyph: "AS" },
  { name: "Jyoti Yadav", role: "CLUB COORDINATOR", line: "Guides the chapter, connects academia and student vision.", glyph: "JY" },
];

const GLYPH_PATTERN = String.raw`.:*#%#*:.`;

export function Team() {
  const { ref, seen } = useReveal<HTMLDivElement>();
  const { ref: qRef, seen: qSeen } = useReveal<HTMLDivElement>();

  return (
    <section id="team" className="relative border-b border-border/60 bg-[#060a07]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">07 / CREW</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            The bridge crew
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Eight humans who keep the compile times short and the vibes compiling.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREW.map((c) => (
              <article
                key={c.name}
                className="group relative overflow-hidden rounded-md border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_8px_40px_rgba(74,222,128,0.08)]"
              >
                {/* ascii pattern banner */}
                <div className="relative h-16 overflow-hidden border-b border-border/60 bg-[#050806]">
                  <div className="absolute inset-0 flex items-center justify-center select-none" aria-hidden="true">
                    <span className="whitespace-nowrap font-mono text-2xl tracking-[0.4em] text-primary/15 transition-all duration-500 group-hover:text-primary/30">
                      {GLYPH_PATTERN.repeat(6)}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(5,8,6,0.9))]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-[0.25em] text-primary/50">
                    {c.role}
                  </span>
                </div>

                <div className="flex items-start gap-4 p-5">
                  <div className="hud-corners grid h-12 w-12 shrink-0 place-items-center rounded-sm border border-primary/30 bg-primary/5 font-mono text-sm font-bold text-primary">
                    {c.glyph}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display truncate text-base font-bold text-foreground group-hover:text-primary">
                      {c.name}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.line}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* chairperson's desk */}
        <div ref={qRef} className={`reveal ${qSeen ? "is-visible" : ""} mt-12`}>
          <div className="scanlines relative overflow-hidden rounded-md border border-primary/25 bg-gradient-to-br from-secondary/60 to-card p-8 sm:p-10">
            <Quote className="absolute right-6 top-6 h-10 w-10 text-primary/15" />
            <p className="font-mono text-[10px] tracking-[0.3em] text-amber-300">
              CAT /var/log/chairperson.msg
            </p>
            <blockquote className="font-display mt-4 max-w-3xl text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              "Welcome to NEXUS. We're not gathering around technology —
              we're <span className="text-glow text-primary">compiling the future</span> one
              commit at a time. Bring your curiosity; the toolchain is ready."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-primary/40 bg-primary/10 font-mono text-xs font-bold text-primary">
                RS
              </span>
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Rohil Sinha</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Chairperson, NEXUS · VIT Chennai
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
