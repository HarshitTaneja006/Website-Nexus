"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileImage, X, ZoomIn, ClipboardCopy, Link2, Blend } from "lucide-react";
import { monoMetrics, paintAscii, RAMPS, renderAscii, frameToText, frameToPngBlob, type AsciiFrame, type AsciiMode } from "@/lib/ascii";
import { useToast } from "@/hooks/use-toast";

/**
 * AsciiLightbox — fullscreen viewer that re-renders a gallery shot as
 * high-resolution ASCII (ASCILINE-style mapper pushed to 60–260 cols).
 * Arrow keys navigate shots, Esc closes, slider dials the glyph density.
 *
 * v2 (continuity round):
 *   - opens in the CARD's render state (initialMode/initialMix) — expanded
 *     frames no longer silently reset to ascii;
 *   - PHOTO mode now actually shows the photo: a real <img> underlay sits
 *     behind the glyph canvas (v1 painted glyphs on a transparent bg with
 *     nothing behind — "photo" mode was just sparse glyphs on black);
 *   - BLEND slider (same semantics as the cards: 100 = full ascii,
 *     0 = full photo) drives the underlay/canvas crossfade;
 *   - canvas gets an explicit CSS px size after every paint — v1 left the
 *     style size unset, so on retina the bitmap (w×dpr) laid out at dpr×
 *     CSS px and object-contain resampled it (the big-view blur);
 *   - repaints once webfonts settle (metrics vs fallback-face drift).
 */

export interface LightboxShot {
  src: string;
  label: string;
  caption: string;
}

const MODES: AsciiMode[] = ["ascii", "pixel", "photo"];

export function AsciiLightbox({
  shots,
  index,
  onClose,
  onNavigate,
  deepLink,
  initialMode = "photo",
  initialMix = 50,
}: {
  shots: LightboxShot[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
  /** when provided, renders a LINK chip that copies a shareable deep URL for the current frame */
  deepLink?: (index: number) => string;
  /** render state inherited from the expanding card */
  initialMode?: AsciiMode;
  initialMix?: number;
}) {
  const shot = shots[index];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<AsciiFrame | null>(null);
  const rafRef = useRef<number>(0);
  const { toast } = useToast();

  const [ready, setReady] = useState(false);
  // open exactly where the card was — photo/50 by default, never a hard reset
  const [mode, setMode] = useState<AsciiMode>(initialMode);
  const [mix, setMix] = useState(initialMix); // 100 = full ascii, 0 = full photo
  const [zoom, setZoom] = useState(150); // target column count
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });

  // reset readiness when the shot changes — state-adjust-during-render pattern
  const [prevSrc, setPrevSrc] = useState(shot.src);
  if (prevSrc !== shot.src) {
    setPrevSrc(shot.src);
    setReady(false);
  }

  // load the frame for the current shot
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = shot.src;
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setReady(true);
    };
    return () => {
      cancelled = true;
    };
  }, [shot.src]);

  const paint = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !img.complete || !img.naturalWidth || !canvas) return;

    // usable viewport area for the glyph canvas
    const maxW = Math.min(window.innerWidth - 48, 1600);
    const maxH = window.innerHeight - 190;
    const aspect = img.naturalHeight / img.naturalWidth;

    // cell geometry from MEASURED metrics — v1 hardcoded 0.6em/1.06em and
    // drifted against the painted font
    const fontSize = 13;
    const { charW, lineH } = monoMetrics(fontSize, 600);
    const cellAspect = charW / lineH;
    const colsByW = maxW / charW;
    const colsByH = maxH / (lineH * aspect * cellAspect);
    const cols = Math.max(40, Math.min(zoom, Math.floor(Math.min(colsByW, colsByH))));

    const frame = renderAscii(img, {
      cols,
      ramp: mode === "pixel" ? RAMPS.blocks : cols >= 110 ? RAMPS.detail : RAMPS.mid,
      mode: mode === "photo" ? "ascii" : mode,
      gamma: 0.75,
      colorize: mode === "pixel",
      supersample: 4,
      sharpen: mode === "ascii" ? 0.45 : 0.2,
      dither: mode === "ascii" ? 0.65 : 0.4,
    });
    frameRef.current = frame;
    setGrid({ cols: frame.cols, rows: frame.rows });

    const size = paintAscii(canvas, frame, {
      fg: "#60a5fa",
      bright: "#eaf3ff",
      bg: mode === "photo" ? null : "#050a12",
      fontSize,
      fontWeight: 600,
      dpr: Math.min(3, window.devicePixelRatio || 1),
    });
    // explicit CSS size — without it the bitmap (css×dpr device px) lays out
    // at dpr× css px on retina and object-contain resamples it into blur
    if (size.width && size.height) {
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
    }
  }, [mode, zoom]);

  // repaint on mode/zoom/ready changes
  useEffect(() => {
    if (!ready) return;
    rafRef.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, paint]);

  // webfonts settle AFTER first paint? repaint with the real face
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) paint();
    });
    return () => {
      alive = false;
    };
  }, [ready, paint]);

  // repaint on window resize (debounced)
  useEffect(() => {
    if (!ready) return;
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(paint, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [ready, paint]);

  // keyboard controls + scroll lock
  // capture-phase: when the lightbox sits ABOVE a Radix dialog (event-brief
  // poster), Escape/Arrows must be consumed here — otherwise the dialog
  // beneath would close in the same keystroke.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "ArrowRight") {
        e.stopPropagation();
        onNavigate((index + 1) % shots.length);
      }
      if (e.key === "ArrowLeft") {
        e.stopPropagation();
        onNavigate((index - 1 + shots.length) % shots.length);
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, shots.length, onClose, onNavigate]);

  const copyDeepLink = useCallback(async () => {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink(index));
      toast({ title: "FRAME LINK COPIED", description: `${shot.label} → clipboard` });
    } catch {
      toast({ title: "CLIPBOARD BLOCKED", description: "link stays in the address bar", variant: "destructive" });
    }
  }, [deepLink, index, shot.label, toast]);

  const step = (dir: 1 | -1) => onNavigate((index + dir + shots.length) % shots.length);

  const exportTxt = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || !frame.lines.length) return;
    const text = frameToText(frame, {
      label: shot.label,
      mode: mode.toUpperCase(),
      source: shot.src,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${shot.label.toLowerCase().replace(/\.(raw|png)$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "FRAME DUMPED", description: `${frame.cols}×${frame.rows} glyphs → .txt` });
  }, [mode, shot.label, shot.src, toast]);

  const copyAscii = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame || !frame.lines.length) return;
    try {
      await navigator.clipboard.writeText(frameToText(frame, { label: shot.label, mode: mode.toUpperCase() }));
      toast({ title: "COPIED", description: "ascii frame → clipboard" });
    } catch {
      toast({ title: "CLIPBOARD BLOCKED", description: "try the .txt export instead", variant: "destructive" });
    }
  }, [mode, shot.label, toast]);

  const exportPng = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame || !frame.lines.length) return;
    const blob = await frameToPngBlob(
      frame,
      { label: shot.label, mode: mode.toUpperCase() },
      { fontSize: mode === "pixel" ? 12 : 14 }
    );
    if (!blob) {
      toast({ title: "PRINT FAILED", description: "frame unavailable — retry", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${shot.label.toLowerCase().replace(/\.(raw|png)$/, "")}.print.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "PRINT SAVED", description: `${frame.cols}×${frame.rows} glyphs → .png typographic print` });
  }, [mode, shot.label, toast]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ASCII lightbox — ${shot.label}`}
      className="fixed inset-0 z-[90] flex flex-col bg-[#03060c]/97 backdrop-blur-sm"
    >
      {/* top chrome */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-[#050a12]/90 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="led led-amber shrink-0" />
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
            {shot.label}
          </span>
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
            {shot.caption}
          </span>
          <span className="shrink-0 rounded-sm border border-border/80 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-primary/80">
            {index + 1}/{shots.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex overflow-hidden rounded-sm border border-border font-mono text-[10px]" role="tablist" aria-label="render mode">
            {MODES.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 uppercase tracking-wider transition-colors ${
                  mode === m
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {deepLink && (
            <button
              onClick={copyDeepLink}
              aria-label="Copy deep link to this frame"
              title="copy frame link"
              className="rounded-sm border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={copyAscii}
            aria-label="Copy ASCII frame to clipboard"
            title="copy frame → clipboard"
            className="rounded-sm border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ClipboardCopy className="h-4 w-4" />
          </button>
          <button
            onClick={exportPng}
            aria-label={`Download ${shot.label} as PNG typographic print`}
            title="print frame → .png"
            className="rounded-sm border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <FileImage className="h-4 w-4" />
          </button>
          <button
            onClick={exportTxt}
            aria-label={`Download ${shot.label} as plain-text ASCII`}
            title="dump frame → .txt"
            className="flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/5 px-2 py-1.5 font-mono text-[10px] tracking-widest text-primary/90 transition-colors hover:border-primary/60 hover:bg-primary/15 hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">.TXT</span>
          </button>
          <button
            onClick={onClose}
            aria-label="Close lightbox"
            className="rounded-sm border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* canvas stage — photo underlay + glyph canvas share one shrink-wrap
          box so the blend aligns with the frame */}
      <div className="scanlines relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {!ready && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="led led-amber" />
            decoding frame…
          </div>
        )}
        <div className="relative max-h-full max-w-full">
          <img
            src={shot.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: mode === "photo" ? 1 : 1 - mix / 100 }}
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="block max-h-full max-w-full object-contain"
            style={{
              imageRendering: "auto",
              opacity: ready ? (mode === "photo" ? mix / 100 : 1) : 0,
            }}
          />
        </div>
        {/* prev / next */}
        <button
          onClick={() => step(-1)}
          aria-label="Previous frame"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-[#050a12]/80 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => step(1)}
          aria-label="Next frame"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-[#050a12]/80 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* bottom readout + zoom */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border/70 bg-[#050a12]/90 px-4 py-2.5 font-mono text-[10px] tracking-widest text-muted-foreground sm:px-6">
        <span className="tabular-nums">
          GRID {grid.cols || "—"}×{grid.rows || "—"} GLYPHS
        </span>
        <div className="flex items-center gap-2.5">
          <Blend className="h-3.5 w-3.5 text-primary/70" />
          <span className="hidden sm:inline">BLEND</span>
          <input
            type="range"
            min={0}
            max={100}
            value={mix}
            onChange={(e) => setMix(Number(e.target.value))}
            aria-label="ASCII to photo blend"
            className="h-1 w-20 cursor-pointer appearance-none rounded bg-border accent-[#60a5fa] sm:w-32"
          />
          <span className="w-8 tabular-nums text-primary/80">{mix}%</span>
        </div>
        <div className="flex items-center gap-2.5">
          <ZoomIn className="h-3.5 w-3.5 text-primary/70" />
          <span className="hidden sm:inline">DENSITY</span>
          <input
            type="range"
            min={60}
            max={260}
            step={2}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="ASCII glyph density"
            className="h-1 w-40 cursor-pointer appearance-none rounded bg-border accent-[#60a5fa] sm:w-56"
          />
          <span className="w-9 tabular-nums text-primary/80">{zoom}c</span>
        </div>
        <span className="hidden lg:inline">← → NAVIGATE · ESC CLOSE · LINK = SHARE FRAME · TXT = DUMP · PNG = PRINT</span>
      </div>
    </div>
  );
}
