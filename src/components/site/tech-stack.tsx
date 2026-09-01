"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useReveal } from "@/components/site/use-reveal";

const DOMAINS = [
  {
    name: "AI & Machine Learning",
    cmd: "aiml",
    desc: "From notebooks to deployed inference. We fine-tune, quantize and ship models that do useful things on campus-sized budgets.",
    tools: ["PyTorch", "HuggingFace", "LangChain", "ONNX", "vLLM"],
  },
  {
    name: "Web Engineering",
    cmd: "web",
    desc: "TypeScript all the way down. Design systems, edge rendering and realtime apps — this very site is one of our artifacts.",
    tools: ["Next.js", "React", "Tailwind", "tRPC", "WebSockets"],
  },
  {
    name: "Cloud & DevOps",
    cmd: "cloud",
    desc: "Clusters on Sundays. Kubernetes in the lab, serverless in production, and CI/CD pipelines that deploy on green tests.",
    tools: ["Docker", "Kubernetes", "AWS", "Terraform", "GitHub Actions"],
  },
  {
    name: "Open Source & DevTools",
    cmd: "os",
    desc: "CLI tools, compilers, libraries and developer tooling. We build and contribute to open software that empowers engineers.",
    tools: ["Rust", "Go", "Git", "TUI Engines", "Linux", "Bun"],
  },
  {
    name: "Mobile Applications",
    cmd: "mobile",
    desc: "Native feel, seamless performance. Jetpack Compose Android, Swift iOS groups, and Flutter / React Native speedruns.",
    tools: ["Kotlin", "Jetpack Compose", "Swift", "Flutter", "React Native"],
  },
];

const TECH_TICKS = [
  "<react />",
  "git commit -m 'ship'",
  "kubectl apply -f app.yaml",
  "model.fit(world)",
  "cargo build --release",
  "SELECT * FROM ideas;",
  "docker run nexus",
  "bun run dev",
];

export function TechStack() {
  const [open, setOpen] = useState<number>(0);
  const { ref, seen } = useReveal<HTMLDivElement>();

  return (
    <section id="stack" className="relative border-b border-border/60 bg-[#060a12]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.4fr] lg:gap-14 lg:py-28">
        {/* copy */}
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""} min-w-0 lg:sticky lg:top-24 lg:self-start`}>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">05 / STACK</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Five domains,
            <br />
            one <span className="text-glow text-primary">workbench</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            We don't do "tech fest only". Each domain runs weekly builds,
            owns real infrastructure, and answers pull requests from members
            of every year.
          </p>
          <p className="mt-6 font-mono text-[10px] tracking-[0.25em] text-muted-foreground/70">
            ▸ SELECT A DIRECTORY TO INSPECT
          </p>

          {/* ascii divider */}
          <div className="mt-8 overflow-hidden rounded-md border border-border/60 bg-[#05080d] py-2">
            <div className="marquee-track-fast">
              {[0, 1].map((h) => (
                <div key={h} className="flex shrink-0" aria-hidden={h === 1}>
                  {TECH_TICKS.map((t) => (
                    <span key={`${h}-${t}`} className="whitespace-nowrap px-4 font-mono text-[10px] text-primary/40">
                      {t} <span className="text-amber-300/40">·</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* terminal */}
        <div className={`reveal ${seen ? "is-visible" : ""} min-w-0`} style={{ transitionDelay: "100ms" }}>
          <div className="overflow-hidden rounded-md border border-border bg-[#05080d] shadow-[0_0_50px_rgba(96,165,250,0.05)]">
            {/* title bar */}
            <div className="flex items-center gap-2 border-b border-border/70 bg-secondary/40 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                nexus@vitc: ~/stack
              </span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">zsh · 80×24</span>
            </div>

            <div className="p-4 sm:p-5">
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                <span className="text-amber-300">$</span> ls -la domains/
              </p>

              <div className="space-y-2">
                {DOMAINS.map((d, i) => {
                  const isOpen = open === i;
                  return (
                    <div
                      key={d.cmd}
                      className={`overflow-hidden rounded-sm border transition-colors ${
                        isOpen ? "border-primary/35 bg-secondary/30" : "border-border/60 hover:border-border"
                      }`}
                    >
                      <button
                        onClick={() => setOpen(isOpen ? -1 : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        />
                        <span className="font-mono text-[10px] text-primary/50">d</span>
                        <span className="font-mono text-sm font-bold tracking-wide text-foreground">
                          {d.cmd}
                          <span className="text-muted-foreground/60">/</span>
                        </span>
                        <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:block">
                          — {d.name}
                        </span>
                        <span
                          className={`ml-auto font-mono text-[9px] tracking-widest transition-colors ${
                            isOpen ? "text-primary" : "text-muted-foreground/50"
                          }`}
                        >
                          {isOpen ? "OPEN" : "INSPECT"}
                        </span>
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-300 ease-out"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="border-t border-border/50 px-4 py-4 sm:pl-12">
                            <p className="text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {d.tools.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-sm border border-primary/25 bg-primary/5 px-2 py-1 font-mono text-[10px] text-primary/90"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 font-mono text-xs text-muted-foreground">
                <span className="text-amber-300">$</span> <span className="cursor-blink inline-block h-3.5 w-2 translate-y-0.5 bg-primary/70" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
