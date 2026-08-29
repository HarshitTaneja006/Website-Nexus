import { Heart } from "lucide-react";
import { ShipLog } from "@/components/site/ship-log";

const ASCII_MARK = String.raw`███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const LINKS = [
  { href: "#flight", label: "The Flight" },
  { href: "#about", label: "Manifesto" },
  { href: "#events", label: "Events" },
  { href: "#stack", label: "Stack" },
  { href: "#gallery", label: "Gallery" },
  { href: "#team", label: "Crew" },
  { href: "#join", label: "Join" },
];

export function Footer() {
  return (
    <footer className="relative mt-auto border-t border-border/60 bg-[#050806]">
      <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* brand */}
          <div>
            <pre
              aria-hidden="true"
              className="select-none text-[5px] leading-[1.2] text-primary/50 sm:text-[6.5px]"
            >
              {ASCII_MARK}
            </pre>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The student tech collective of VIT Chennai — empowering the next
              generation of innovators through collaboration, learning and
              cutting-edge projects.
            </p>
            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70">
              <span className="led" />
              SYSTEM NOMINAL · SERVED FROM CAMPUS GRID
            </div>
          </div>

          {/* links */}
          <nav aria-label="Footer">
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">SITEMAP</p>
            <ul className="mt-4 space-y-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="group font-mono text-xs text-foreground/75 transition-colors hover:text-primary"
                  >
                    <span className="text-primary/40 group-hover:text-primary">▸ </span>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* contact */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">CONTACT</p>
            <ul className="mt-4 space-y-2 font-mono text-xs text-foreground/75">
              <li>
                <a href="mailto:nexusvitc@gmail.com" className="transition-colors hover:text-primary">
                  nexusvitc@gmail.com
                </a>
              </li>
              <li>VIT Chennai, India</li>
              <li className="pt-2 text-muted-foreground">Faculty: Dr. S. Pavithra</li>
              <li className="text-muted-foreground">Dr. Lekshmi K</li>
            </ul>
          </div>
        </div>

        {/* ship log */}
        <ShipLog />

        {/* bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 font-mono text-[10px] text-muted-foreground/70 sm:flex-row">
          <p>© 2026 NEXUS CLUB · ALL RIGHTS RESERVED</p>
          <p className="flex flex-wrap items-center justify-center gap-1.5">
            RENDERED WITH <Heart className="h-3 w-3 text-primary/70" /> ·
            <span className="text-primary/60">lets-scroll</span> scrub engine ·
            <span className="text-primary/60">asciline</span>-style ascii
          </p>
        </div>
      </div>
    </footer>
  );
}
