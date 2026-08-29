"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

/**
 * ShortcutsDialog — the site's MAN page. `?` (shift+/) opens it anywhere
 * outside a text field; the ⌘K palette and the footer can also dispatch
 * the `nexus:shortcuts` CustomEvent.
 */

export const SHORTCUTS_EVENT = "nexus:shortcuts";

interface Row {
  keys: string[];
  desc: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "SHELL",
    rows: [
      { keys: ["⌘", "K"], desc: "command palette — navigate, switch engines, ops" },
      { keys: ["?"], desc: "this manual" },
      { keys: ["ESC"], desc: "close the topmost surface (palette / dialogs / lightbox)" },
    ],
  },
  {
    title: "FLIGHT",
    rows: [
      { keys: ["SCROLL"], desc: "scrub the camera through the four scenes" },
      { keys: ["#scene-gate … #scene-community"], desc: "deep-link straight into a scene" },
      { keys: ["🔗 LINK"], desc: "per-scene chip copies the deep URL" },
    ],
  },
  {
    title: "GALLERY",
    rows: [
      { keys: ["←", "→"], desc: "navigate frames while the lightbox is open" },
      { keys: ["#frame-1 … 4"], desc: "deep-link a frame — LINK chip copies it" },
      { keys: ["TXT / PNG"], desc: "dump the live glyph grid or print it" },
    ],
  },
  {
    title: "EVENTS",
    rows: [
      { keys: ["?event=<slug>"], desc: "deep-link an event — RSVP pre-opens (archive → brief)" },
      { keys: ["SHARE"], desc: "invite text carries the ?event= deep link" },
      { keys: ["MY.RSVP"], desc: "scan any email against the RSVP ledger" },
    ],
  },
  {
    title: "WIRE & FEEDS",
    rows: [
      { keys: ["?unsub=<email>"], desc: "one-click opt-out from the signal wire" },
      { keys: ["/api/feed.xml"], desc: "RSS — events + news" },
      { keys: ["/api/calendar.ics"], desc: "subscribe all events (VALARM 24h + 60m)" },
    ],
  },
  {
    title: "GLYPH ENGINE",
    rows: [
      { keys: ["RAIN / WAVE / DONUT / CAM"], desc: "hero background presets (HUD or palette)" },
      { keys: ["DUMP .TXT / PRINT .PNG"], desc: "export the exact on-screen glyph grid" },
      { keys: ["↑↑↓↓←→←→BA"], desc: "???  — old pilots know this one" },
    ],
  },
];

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SHORTCUTS_EVENT, onOpen);
    return () => window.removeEventListener(SHORTCUTS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return; // typing — let "?" be a character
      }
      e.preventDefault();
      setOpen((o) => !o);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="thin-scroll max-h-[85vh] overflow-y-auto border-primary/25 bg-[#070c08] p-0 font-mono sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 bg-secondary/40 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm tracking-[0.25em] text-primary">
            <Keyboard className="h-3.5 w-3.5" />
            NEXUS(1) — SHELL MANUAL
          </DialogTitle>
          <DialogDescription className="text-[10px] tracking-widest text-muted-foreground">
            every key, deep link and feed the grid responds to
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          {GROUPS.map((g, gi) => (
            <section key={g.title} className={gi > 0 ? "mt-5" : ""} aria-label={g.title}>
              <p className="flex items-center gap-3 text-[10px] tracking-[0.3em] text-primary">
                {g.title}
                <span className="h-px flex-1 bg-primary/15" aria-hidden="true" />
                <span className="text-muted-foreground/40">{String(gi + 1).padStart(2, "0")}</span>
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {g.rows.map((r) => (
                  <li
                    key={r.desc}
                    className="flex flex-col gap-1 rounded-sm border border-transparent px-2 py-1.5 transition-colors hover:border-border/60 hover:bg-secondary/30 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex shrink-0 flex-wrap items-center gap-1 sm:min-w-[13rem]">
                      {r.keys.map((k, ki) => (
                        <span key={`${k}-${ki}`} className="flex items-center gap-1">
                          {ki > 0 && <span className="text-[9px] text-muted-foreground/50">+</span>}
                          <kbd className="kbd">{k}</kbd>
                        </span>
                      ))}
                    </span>
                    <span className="text-[11px] leading-relaxed text-muted-foreground">{r.desc}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="mt-5 border-t border-border/60 pt-3 text-[9px] tracking-widest text-muted-foreground/60">
            NEXUS SHELL v2.6 · MANUAL UPDATED ROUND 11 · PRESS <span className="kbd">?</span> ANYTIME
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
