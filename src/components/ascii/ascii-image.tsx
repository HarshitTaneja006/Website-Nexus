"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, FileDown } from "lucide-react";
import { monoMetrics, paintAscii, RAMPS, renderAscii, frameToText, type AsciiFrame, type AsciiMode } from "@/lib/ascii";
import { useToast } from "@/hooks/use-toast";

/**
 * AsciiImage — renders a real image as live ASCII text on a canvas.
 * Mode switcher mirrors ASCILINE's output modes:
 *   ASCII (glyphs) / PIXEL (colored blocks) / PHOTO (original pixels).
 * A crossfade slider blends between the ASCII layer and the photo.
 *
 * v2 (crisp rewrite):
 *   - grid is EXACT-FIT: cols/rows are derived from the measured cell
 *     metrics and the real box size, so the canvas is displayed 1:1 —
 *     v1 rendered at ~77% and let object-cover upscale it 1.3× (blur);
 *   - the v2 render pipeline (box-filter supersampling + unsharp
 *     definition pass) replaces the single-point sampling;
 *   - canvas DPR headroom raised to 3 for retina-crisp glyph edges.
 *
 * v3 (clarity round):
 *   - Bayer ORDERED DITHERING before glyph quantization — flat midtones
 *     become structured glyph texture instead of banded mud (the single
 *     biggest perceived-resolution win);
 *   - wide 70-glyph DETAIL ramp for grids ≥110 columns — more tonal steps
 *     = smoother gradients on the large cards;
 *   - supersample raised to 4× — every cell is a true 4×4 area average.
 *
 * v4 (defaults round): full cards open in PHOTO mode with the blend
 *   slider parked at 50 — photo readable at first glance, glyphs woven
 *   through it; the slider is now a pure blend control in every mode
 *   (no auto tab-flip on release). compact posters stay pure ASCII.
 *
 * v5 (crisp + continuity round):
 *   - glyph size tiers raised (8/10/11px) and painted BOLD (700) — small
 *     regular-weight glyphs antialias into mush on dark bg; bold ink per
 *     cell is the difference between "fuzzy texture" and "defined art";
 *   - the ascii canvas is ALWAYS mounted and controlled purely by opacity:
 *     unmounting it at mix=0 and remounting left a blank canvas with no
 *     repaint trigger (the "slider to zero and back = dead ascii" bug);
 *   - re-render once webfonts settle (document.fonts.ready) so metrics
 *     measured against a fallback face never persist;
 *   - EXPAND now hands the card's {mode, mix} to the lightbox — extended
 *     view opens exactly where the card was (no silent reset to ascii).
 */

interface AsciiImageProps {
  src: string;
  label: string;
  caption: string;
  /** expanded — receives the card's current render state for the lightbox */
  onExpand?: (state: { mode: AsciiMode; mix: number }) => void;
  /**
   * compact: poster mode — no mode tabs, no blend slider. Just the live
   * glyph render, the .TXT dump and the expand affordance (event dialogs).
   */
  compact?: boolean;
}

const MODES: AsciiMode[] = ["ascii", "pixel", "photo"];

export function AsciiImage({ src, label, caption, onExpand, compact = false }: AsciiImageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<AsciiFrame | null>(null);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  // full cards open in PHOTO (blended) — compact posters stay pure ASCII
  const [mode, setMode] = useState<AsciiMode>(compact ? "ascii" : "photo");
  const [mix, setMix] = useState(compact ? 100 : 50); // 100 = full ascii, 0 = full photo
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });
  const [srcDims, setSrcDims] = useState({ w: 0, h: 0 });
  const { toast } = useToast();

  const renderNow = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!img || !img.complete || !img.naturalWidth || !wrap || !canvas) return;

    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;

    // v5 tiers: 8/10/11px BOLD — bigger cells + heavy ink read as crisp;
    // the old 7–9px regular weights antialiased into an illegible haze
    const fontSize = w < 420 ? 8 : w < 760 ? 10 : 11;
    const { charW, lineH } = monoMetrics(fontSize, 700);
    // exact-fit grid → intrinsic canvas size == display size (1:1, no stretch)
    const cols = Math.max(32, Math.round(w / charW));
    const rows = Math.max(14, Math.round(h / lineH));

    const frame = renderAscii(img, {
      cols,
      rows,
      ramp: mode === "pixel" ? RAMPS.blocks : cols >= 110 ? RAMPS.detail : RAMPS.mid,
      mode: mode === "photo" ? "ascii" : mode,
      gamma: 0.8,
      colorize: mode === "pixel",
      supersample: 4,
      sharpen: mode === "ascii" ? 0.5 : 0.2,
      dither: mode === "ascii" ? 0.7 : 0.45,
    });
    frameRef.current = frame;
    setGrid({ cols: frame.cols, rows: frame.rows });

    paintAscii(canvas, frame, {
      fg: "#4ade80",
      bright: "#eaffef",
      bg: "#070d08",
      fontSize,
      fontWeight: 700,
      dpr: Math.min(3, window.devicePixelRatio || 1),
    });
  }, [mode]);

  // load image once
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      setSrcDims({ w: img.naturalWidth, h: img.naturalHeight });
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

  // webfonts settle AFTER first paint? re-render with the real face —
  // metrics measured against a fallback stack would smear every run
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) renderNow();
    });
    return () => {
      alive = false;
    };
  }, [ready, renderNow]);

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

  const exportTxt = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || !frame.lines.length) return;
    const text = frameToText(frame, { label, mode: mode.toUpperCase(), source: src });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${label.toLowerCase().replace(/\.(raw|png)$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "FRAME DUMPED", description: `${frame.cols}×${frame.rows} glyphs → .txt` });
  }, [label, mode, src, toast]);
  return (
    <figure className="group relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      {/* window chrome */}
      <figcaption className="flex items-center justify-between gap-2 border-b border-border/70 bg-secondary/40 px-3 py-2">
        <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {!compact && (
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
        )}
        {compact && (
          <span className="font-mono text-[9px] tracking-[0.25em] text-primary/60" aria-hidden="true">
            ASCII.POSTER
          </span>
        )}
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
        {/* ascii layer — always mounted (opacity-controlled): unmounting it
            at mix=0 and remounting left a blank canvas with no repaint */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: mode === "photo" ? mix / 100 : 1,
            visibility: showAscii ? "visible" : "hidden",
            imageRendering: "auto",
          }}
          aria-hidden="true"
        />
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
            onClick={() => onExpand({ mode, mix })}
            aria-label={`Open ${label} in full-res viewer`}
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
          GRID {grid.cols || "—"}×{grid.rows || "—"} · SRC{" "}
          {srcDims.w ? `${srcDims.w}×${srcDims.h}` : "—"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={exportTxt}
            aria-label={`Download ${label} as plain-text ASCII`}
            title="dump frame → .txt"
            className="rounded-sm border border-transparent p-1 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            <FileDown className="h-3.5 w-3.5" />
          </button>
          {!compact && (
            <input
              type="range"
              min={0}
              max={100}
              value={mix}
              onChange={(e) => setMix(Number(e.target.value))}
              aria-label={`ASCII to photo blend for ${label}`}
              className="h-1 w-24 cursor-pointer appearance-none rounded bg-border accent-[#4ade80]"
            />
          )}
        </div>
      </div>
    </figure>
  );
}
