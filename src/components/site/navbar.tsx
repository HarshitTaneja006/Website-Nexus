"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/site/command-palette";
import { OpsConsole } from "@/components/site/ops-console";
import { ShortcutsDialog, SHORTCUTS_EVENT } from "@/components/site/shortcuts-dialog";
import { usePresence } from "@/hooks/use-presence";

const LINKS = [
  { href: "#flight", label: "FLIGHT" },
  { href: "#about", label: "ABOUT" },
  { href: "#events", label: "EVENTS" },
  { href: "#news", label: "NEWS" },
  { href: "#stack", label: "STACK" },
  { href: "#gallery", label: "GALLERY" },
  { href: "#team", label: "TEAM" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("--:--:--");
  const [active, setActive] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { online, connected } = usePresence();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 32);
      if (y < window.innerHeight * 0.45) setActive("");
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Calcutta",
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // active section tracking
  useEffect(() => {
    const ids = LINKS.map((l) => l.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
      <OpsConsole />
      <ShortcutsDialog />
      {/* scroll progress */}
      <div className="fixed inset-x-0 top-0 z-[70] h-[2px] bg-transparent">
        <div
          className="h-full origin-left bg-gradient-to-r from-primary via-[#a7f3d0] to-amber-300"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <header
        className={`fixed inset-x-0 top-0 z-[60] transition-all duration-300 ${
          scrolled
            ? "border-b border-border/60 bg-[#050806]/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
          <a href="#top" className="group flex items-center gap-2 font-mono text-sm font-bold tracking-widest">
            <span className="grid h-7 w-7 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
              N
            </span>
            <span className="text-glow text-foreground">
              NEXUS<span className="cursor-blink text-primary">_</span>
            </span>
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`nav-sweep relative px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors ${
                  active === l.href ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={active === l.href ? "" : "text-primary/40"}>./</span>
                {l.label}
                {active === l.href && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-px bg-primary shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                )}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div
              className="hidden items-center gap-2 font-mono text-[10px] text-muted-foreground md:flex"
              title="live builders connected right now"
            >
              <span className={`led ${connected ? "" : "opacity-40"}`} />
              <span className="tabular-nums">
                {online == null ? "--" : online} <span className="text-primary/60">ON GRID</span>
              </span>
            </div>
            <div className="hidden items-center gap-2 font-mono text-[10px] text-muted-foreground md:flex">
              <span className="tabular-nums">{time} IST</span>
            </div>
            <Button asChild size="sm" className="hidden font-mono text-[11px] tracking-widest sm:inline-flex">
              <a href="#join">JOIN_US</a>
            </Button>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              title="command palette"
              className="hidden items-center gap-1.5 rounded-sm border border-border bg-card/60 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-all hover:border-primary/50 hover:text-primary md:flex"
            >
              <span>⌘K</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT))}
              aria-label="Keyboard shortcuts and deep links manual"
              title="shortcuts manual (?)"
              className="hidden h-8 w-8 items-center justify-center rounded-sm border border-border bg-card/60 font-mono text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:text-primary md:flex"
            >
              ?
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-sm border border-border text-foreground lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      {/* mobile overlay */}
      <div
        className={`scanlines fixed inset-0 z-[65] flex flex-col bg-[#050806]/97 backdrop-blur-md transition-all duration-300 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="grid-bg flex flex-1 flex-col justify-center gap-1 px-8">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="group flex items-baseline gap-3 border-b border-border/40 py-3 font-mono transition-colors"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <span className="text-[10px] text-primary/50">0{i + 1}</span>
              <span className="text-2xl font-bold tracking-widest text-foreground group-hover:text-primary">
                {l.label}
              </span>
              <span className="ml-auto text-primary/40 transition-transform group-hover:translate-x-1">→</span>
            </a>
          ))}
          <a
            href="#join"
            onClick={() => setOpen(false)}
            className="mt-6 inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 font-mono text-sm font-bold tracking-widest text-primary-foreground"
          >
            JOIN_US
          </a>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 px-8 py-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="led" />
            {online == null ? "--" : online} ON GRID
          </span>
          <span className="tabular-nums">{time} IST</span>
        </div>
      </div>
    </>
  );
}
