"use client";

import { useEffect, useRef, useState } from "react";
import { ENGINE_EVENT } from "@/components/site/command-palette";
import { useToast } from "@/hooks/use-toast";

/**
 * KonamiEgg — ↑↑↓↓←→←→BA overdrive.
 * Flashes a full-screen ASCII NEXUS banner (figlet-style), toasts, and
 * kicks the hero engine into donut mode. Purely additive, zero effect on
 * normal interaction.
 */

const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

const BANNER = String.raw`
███╗   ██╗███████╗██╗   ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝██║   ██║██║   ██║██╔════╝
██╔██╗ ██║█████╗  ██║   ██║██║   ██║███████╗
██║╚██╗██║██╔══╝  ╚██╗ ██╔╝██║   ██║╚════██║
██║ ╚████║███████╗ ╚████╔╝ ╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝  ╚═══╝   ╚═════╝ ╚══════╝`;

export function KonamiEgg() {
  const [show, setShow] = useState(false);
  const pos = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const expected = CODE[pos.current];
      const hit = e.key === expected || e.key.toLowerCase() === expected.toLowerCase();
      if (!hit) {
        pos.current = e.key === CODE[0] ? 1 : 0;
        return;
      }
      pos.current += 1;
      if (pos.current === CODE.length) {
        pos.current = 0;
        setShow(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setShow(false), 3400);
        window.dispatchEvent(new CustomEvent(ENGINE_EVENT, { detail: "donut" }));
        toast({
          title: "CHEAT CODE ACCEPTED",
          description: "OVERDRIVE — donut engine to max lum",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className="scanlines fixed inset-0 z-[95] grid place-items-center bg-[#03060c]/95 backdrop-blur-[2px] duration-300 animate-in fade-in zoom-in-95"
      onClick={() => setShow(false)}
    >
      <div className="px-4 text-center">
        <pre
          className="text-glow origin-center text-[4.4vw] font-bold leading-[1.06] text-primary sm:text-[min(3vw,42px)]"
          style={{ animation: "led-pulse 0.9s ease-in-out infinite" }}
        >
          {BANNER}
        </pre>
        <p className="mt-4 font-mono text-[10px] tracking-[0.4em] text-amber-300 text-glow-amber sm:text-xs">
          OVERDRIVE ENGAGED
        </p>
        <p className="mt-1.5 font-mono text-[9px] tracking-[0.25em] text-muted-foreground/70">
          30 YEARS OF PHOSPHOR · CLICK TO DISMISS
        </p>
      </div>
    </div>
  );
}
