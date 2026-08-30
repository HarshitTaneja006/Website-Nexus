"use client";

import { useEffect, useRef, useState } from "react";

const LOGO = String.raw`
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const LINES = [
  "$ nexus --boot",
  "[ok] core systems online",
  "[ok] ascii engine v2.1 · mode 32k",
  "[ok] scroll-flight camera rig mounted",
  "[ok] events db synced",
  "[ok] news uplink connected",
  "> welcome, visitor",
];

export function BootLoader() {
  const [visible, setVisible] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // ?noboot skips the sequence entirely — QA runs and demo replays
    // shouldn't wait for (or double-fire) the boot animation
    const noBoot = new URLSearchParams(window.location.search).has("noboot");
    if (reduced || noBoot || sessionStorage.getItem("nexus-booted")) {
      const skip = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(skip);
    }
    document.body.style.overflow = "hidden";
    sessionStorage.setItem("nexus-booted", "1");

    const lineTimer = setInterval(() => {
      setLineCount((c) => {
        if (c >= LINES.length) {
          clearInterval(lineTimer);
          return c;
        }
        return c + 1;
      });
    }, 150);

    const progTimer = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.round(4 + Math.random() * 9)));
    }, 60);

    const finish = setTimeout(() => dismiss(), 1500);

    function dismiss() {
      if (doneRef.current) return;
      doneRef.current = true;
      document.body.style.overflow = "";
      setVisible(false);
    }

    const onKey = () => dismiss();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(lineTimer);
      clearInterval(progTimer);
      clearTimeout(finish);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="crt-power scanlines fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-[#050806] transition-opacity duration-500"
      onClick={() => {
        doneRef.current = true;
        document.body.style.overflow = "";
        setVisible(false);
      }}
      role="button"
      aria-label="Skip boot sequence"
    >
      <div className="grain absolute inset-0" />
      <pre className="relative select-none px-4 text-[5px] leading-[1.15] text-primary/90 text-glow sm:text-[7px] md:text-[9px]">
        {LOGO}
      </pre>
      <div className="relative mt-6 w-[min(420px,86vw)] font-mono text-[11px] leading-relaxed text-primary/70">
        {LINES.slice(0, lineCount).map((l, i) => (
          <p key={i} className={l.startsWith("[ok]") ? "text-primary/55" : "text-amber-300/80"}>
            {l}
            {i === lineCount - 1 && lineCount < LINES.length ? (
              <span className="cursor-blink ml-0.5 inline-block h-3 w-[7px] translate-y-[2px] bg-primary" />
            ) : null}
          </p>
        ))}
      </div>
      <div className="relative mt-6 w-[min(420px,86vw)]">
        <div className="mb-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>INITIALIZING</span>
          <span className="tabular-nums text-primary/80">{Math.min(progress, 100)}%</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded bg-secondary">
          <div
            className="h-full bg-gradient-to-r from-primary via-[#a7f3d0] to-amber-300 shadow-[0_0_12px_rgba(74,222,128,0.55)] transition-[width] duration-100"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
      <p className="relative mt-8 font-mono text-[10px] tracking-widest text-muted-foreground/60">
        PRESS ANY KEY TO SKIP
      </p>
    </div>
  );
}
