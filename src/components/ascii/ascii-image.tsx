"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { paintAscii, renderAscii, colsForWidth, type AsciiMode, type AsciiFrame } from "@/lib/ascii";

/**
 * AsciiImage — renders a real image as live ASCII text on a canvas.
 * Mode switcher mirrors ASCILINE's output modes:
 *   ASCII (glyphs) / PIXEL (colored blocks) / PHOTO (original pixels).
 * A crossfade slider blends between the ASCII layer and the photo.
 */

interface AsciiImageProps {
  src: string;
  label: string;
  caption: string;
  onExpand?: () => void;
}

const MODES: AsciiMode[] = ["ascii", "pixel", "photo"];

export function AsciiImage({ src, label, caption, onExpand }: AsciiImageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<AsciiFrame | null>(null);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AsciiMode>("ascii");
  const [mix, setMix] = useState(82); // 100 = full ascii, 0 = full photo
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });

  const renderNow = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!img || !img.complete || !img.naturalWidth || !wrap || !canvas) return;

    const width = wrap.clientWidth;
    const fontSize = width < 420 ? 6 : width < 720 ? 7 : 8;
    // 0.78 divisor → fewer, chunkier glyphs: reads as an image at card size
    const cols = colsForWidth(width, fontSize * 0.78);

    const frame = renderAscii(img, {
      cols,
      ramp: mode === "pixel" ? " .·:;=+x%#@" : " .,:;-~=+*x%#@",
      mode: mode === "photo" ? "ascii" : mode,
      gamma: 0.68,
      colorize: mode === "pixel",
    });
    frameRef.current = frame;
    setGrid({ cols: frame.cols, rows: frame.rows });

    paintAscii(canvas, frame, {
      fg: "#4ade80",
      bright: "#d9ffe4",
      bg: "#070d08",
      fontSize,
    });
  }, [mode]);

  // load image once
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      renderNow();
    };
  }, [src]);

  // re-render when mode changes (after paint so state settles)
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => renderNow());
    return () => cancelAnimationFrame(id);
  }, [mode, ready, renderNow]);

  // resize re-render (debounced)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ready) return;
    const onResize = () => {
      if (renderTimer.current) clearTimeout(renderTimer.current);
      renderTimer.current = setTimeout(renderNow, 180);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [ready, renderNow]);

  const showAscii = mode !== "photo" || mix > 0;

  return (
    <figure className="group relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      {/* window chrome */}
      <figcaption className="flex items-center justify-between gap-2 border-b border-border/70 bg-secondary/40 px-3 py-2">
        <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1" role="tablist" aria-label={`${label} render mode`}>
          {MODES.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                mode === m
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </figcaption>

      {/* render surface */}
      <div ref={wrapRef} className="relative aspect-[4/3] min-h-0 flex-1 overflow-hidden bg-[#070d08]">
        {/* photo underlay */}
        <img
          src={src}
          alt={caption}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: mode === "photo" ? 1 : 1 - mix / 100 }}
          loading="lazy"
        />
        {/* ascii layer */}
        {showAscii && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: mode === "photo" ? mix / 100 : 1,
              imageRendering: "pixelated",
            }}
            aria-hidden="true"
          />
        )}
        {!ready && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="led led-amber" />
              loading frame…
            </div>
          </div>
        )}
        {/* expand affordance */}
        {onExpand && ready && (
          <button
            onClick={onExpand}
            aria-label={`Open ${label} in full-res ASCII lightbox`}
            className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-sm border border-primary/30 bg-[#050a06]/85 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.2em] text-primary/90 opacity-0 backdrop-blur-sm transition-all duration-200 hover:border-primary/60 hover:bg-primary/15 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Expand className="h-3 w-3" />
            EXPAND
          </button>
        )}
        {/* scanlines + vignette */}
        <div className="scanlines pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
      </div>

      {/* footer readout */}
      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-secondary/30 px-3 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          GRID {grid.cols || "—"}×{grid.rows || "—"} · SRC 1152×864
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={mix}
          onChange={(e) => setMix(Number(e.target.value))}
          onMouseUp={() => {
            if (mode === "photo" && mix > 0) setMode("ascii");
          }}
          aria-label={`ASCII to photo blend for ${label}`}
          className="h-1 w-24 cursor-pointer appearance-none rounded bg-border accent-[#4ade80]"
        />
      </div>
    </figure>
  );
}
