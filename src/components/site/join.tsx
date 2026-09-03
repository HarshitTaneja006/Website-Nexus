"use client";

import { Github, Instagram, Linkedin, Mail, MapPin } from "lucide-react";
import { useReveal } from "@/components/site/use-reveal";

const SOCIALS = [
  { icon: Github, label: "GitHub", href: "https://github.com/harshittaneja006/nexus-website" },
  { icon: Instagram, label: "Instagram", href: "https://www.instagram.com/nexus_vitc/" },
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/company/nexusvitchennai/" },
];

export function Join() {
  const { ref, seen } = useReveal<HTMLDivElement>();

  return (
    <section id="join" className="relative bg-[#070b14]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28">
        {/* info */}
        <div ref={ref} className={`reveal ${seen ? "is-visible" : ""}`}>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">08 / UPLINK</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Join the <span className="text-glow text-primary">collective</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Applications open during specific recruitment cycles throughout the year. Pitch yourself, and we'll match you with a team, a mentor, and a deadline.
          </p>

          <div className="mt-8 space-y-3 font-mono text-xs">
            <a
              href="mailto:nexusvitc@gmail.com"
              className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
            >
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-border bg-card">
                <Mail className="h-4 w-4 text-primary/70" />
              </span>
              nexusvitc@gmail.com
            </a>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-border bg-card">
                <MapPin className="h-4 w-4 text-primary/70" />
              </span>
              VIT Chennai, Kelambakkam - 600127
            </div>
          </div>

          <div className="mt-8 rounded-md border border-border bg-card/60 p-5">
            <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
              FACULTY_COORDINATORS
            </p>
            <p className="mt-2 text-sm text-foreground">Dr. S. Pavithra</p>
            <p className="text-sm text-foreground">Dr. Lekshmi K</p>
          </div>

          <div className="mt-8 flex gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="grid h-10 w-10 place-items-center rounded-sm border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* recruitment moved to the dedicated external portal */}
        <div className={`reveal ${seen ? "is-visible" : ""}`} style={{ transitionDelay: "100ms" }}>
          <div className="hud-corners overflow-hidden rounded-md border border-border bg-[#05080d]">
            <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-4 py-2.5">
              <span className="font-mono text-[11px] text-muted-foreground">nexus@vitc: ~/join</span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-primary/80">
                <span className="led" /> EXTERNAL PORTAL
              </span>
            </div>
            <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center sm:p-10">
              <p className="font-mono text-[10px] tracking-[0.3em] text-primary">RECRUITMENT LIVE</p>
              <h3 className="font-display mt-4 text-2xl font-bold text-foreground sm:text-3xl">
                Apply for NEXUS Crew
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Recruitment has moved to our dedicated portal at nexusrecruitment.vercel.app. Transmit your application there to join the collective.
              </p>
              <a
                href="https://nexusrecruitment.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-mono text-xs font-bold tracking-widest text-primary-foreground transition-all hover:shadow-[0_0_28px_rgba(96,165,250,0.45)]"
              >
                LAUNCH RECRUITMENT PORTAL ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
