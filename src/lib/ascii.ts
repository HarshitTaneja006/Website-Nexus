/**
 * ascii.ts — a compact, client-side ASCII rendering engine.
 *
 * Heavily inspired by ASCILINE (https://github.com/YusufB5/ASCILINE):
 * "turns the browser canvas into a typographic display surface" by mapping
 * pixel luminance/color to text glyphs. This is the static-image flavour of
 * that idea — the animated presets (rain / donut / wave) live in
 * components/ascii/ascii-canvas.tsx.
 */

export type AsciiMode = "ascii" | "pixel" | "photo";

/** Character ramps, dark → bright (like ASCILINE's AsciiMapper). */
export const RAMPS = {
  /** compact classic ramp — good for display-sized renders */
  short: " .':-=+*#%@",
  /** phosphor-flavoured ramp with block glyphs */
  blocks: " .·:;=+x%#@",
  /** high-detail 70-glyph ramp for large canvases */
  detail:
    "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
} as const;

export interface AsciiRenderOptions {
  /** number of character columns (rows derive from aspect + line height) */
  cols: number;
  /** glyph ramp to use */
  ramp?: string;
  /** render mode: ascii glyphs / colored blocks / plain photo passthrough */
  mode?: AsciiMode;
  /** darken shadows for CRT feel (0..1) */
  gamma?: number;
  /** invert ramp mapping (light text on dark bg) */
  invert?: boolean;
  /** color the glyphs with the source pixel color (ascii mode) */
  colorize?: boolean;
  /**
   * percentile-based histogram stretch (default true) — rescues dark/flat
   * sources by remapping the 2nd..98th luminance percentiles to 0..1
   */
  autoLevels?: boolean;
}

export interface AsciiFrame {
  /** one string per row */
  lines: string[];
  /** per-cell color (css string), only when colorize/pixel */
  colors: (string | null)[][];
  cols: number;
  rows: number;
}

const hexCache = new Map<string, string>();

function toCss(r: number, g: number, b: number, boost: number): string {
  const key = `${r >> 3}:${g >> 3}:${b >> 3}`;
  let css = hexCache.get(key);
  if (!css) {
    const rr = Math.min(255, Math.round(r * boost));
    const gg = Math.min(255, Math.round(g * boost));
    const bb = Math.min(255, Math.round(b * boost));
    css = `rgb(${rr},${gg},${bb})`;
    hexCache.set(key, css);
  }
  return css;
}

/**
 * Render an image (or canvas) into an AsciiFrame using an offscreen sampler.
 * Mirrors ASCILINE's pipeline: decode → downsample → luminance → glyph map.
 */
export function renderAscii(
  source: HTMLImageElement | HTMLCanvasElement,
  opts: AsciiRenderOptions
): AsciiFrame {
  const cols = Math.max(8, Math.floor(opts.cols));
  const mode = opts.mode ?? "ascii";
  const ramp = opts.ramp ?? RAMPS.blocks;
  const gamma = opts.gamma ?? 0.9;
  const invert = opts.invert ?? false;
  const colorize = opts.colorize ?? false;

  const sw = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!sw || !sh) return { lines: [], colors: [], cols: 0, rows: 0 };

  // monospace cells: charW ≈ 0.6em wide / 1.06em line height (paintAscii uses
  // the same geometry) — cells are ~1.77× taller than wide, so a correct
  // aspect-preserving frame needs rows = cols * (sh/sw) * (charW / lineH).
  // (The old `/ 0.58` stretched frames ~3× vertically; object-cover hid it.)
  const cellAspect = 0.6 / 1.06; // ≈ 0.566
  const rows = Math.max(4, Math.round(cols * (sh / sw) * cellAspect));

  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { lines: [], colors: [], cols: 0, rows: 0 };

  ctx.drawImage(source, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;

  // --- optional auto-levels: luminance histogram stretch (2%..98%) ---
  let lo = 0;
  let hi = 1;
  if (opts.autoLevels !== false) {
    const hist = new Uint32Array(256);
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      if (a < 0.1) continue;
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      hist[Math.min(255, Math.round(lum * 255))]++;
      opaque++;
    }
    if (opaque > 32) {
      const cut = opaque * 0.02;
      let acc = 0;
      for (let b = 0; b < 256; b++) {
        acc += hist[b];
        if (acc >= cut) {
          lo = b / 255;
          break;
        }
      }
      acc = 0;
      for (let b = 255; b >= 0; b--) {
        acc += hist[b];
        if (acc >= cut) {
          hi = b / 255;
          break;
        }
      }
      if (hi - lo < 0.12) {
        lo = 0; // nearly flat frame — don't overstretch noise
        hi = 1;
      }
    }
  }
  const span = Math.max(0.05, hi - lo);

  const lines: string[] = [];
  const colors: (string | null)[][] = [];
  const n = ramp.length - 1;

  for (let y = 0; y < rows; y++) {
    let line = "";
    const rowColors: (string | null)[] = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3] / 255;
      // perceptual luminance, auto-leveled then gamma-shaped
      let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lum = Math.min(1, Math.max(0, (lum * a - lo) / span));
      lum = Math.pow(lum, gamma);
      if (invert) lum = 1 - lum;

      if (mode === "pixel") {
        // colored block glyph █ — the "--pixel" flag of ASCILINE
        const idx = lum < 0.08 ? 0 : Math.max(1, Math.round(lum * n));
        line += idx === 0 ? " " : "█";
        rowColors.push(idx === 0 ? null : toCss(r, g, b, 1.12));
      } else {
        const idx = Math.round(lum * n);
        line += ramp[idx];
        rowColors.push(colorize && idx > 0 ? toCss(r, g, b, 1.35) : null);
      }
    }
    lines.push(line);
    colors.push(rowColors);
  }

  return { lines, colors, cols, rows };
}

/** Paint an AsciiFrame onto a visible canvas with phosphor styling. */
export function paintAscii(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame,
  o: {
    fg: string;
    bg?: string | null;
    bright?: string;
    fontSize?: number;
    dpr?: number;
  }
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || !frame.lines.length) return;
  const dpr = o.dpr ?? Math.min(2, window.devicePixelRatio || 1);
  const fontSize = o.fontSize ?? 10;
  const lineHeight = fontSize * 1.06;
  const charW = fontSize * 0.6;

  const width = frame.cols * charW;
  const height = frame.rows * lineHeight;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.font = `${fontSize}px var(--font-geist-mono), monospace`;
  ctx.textBaseline = "top";

  for (let y = 0; y < frame.lines.length; y++) {
    const line = frame.lines[y];
    const rowColors = frame.colors[y];
    let x = 0;
    let run = "";
    let runColor: string | null = o.fg;
    // flush current run when color changes — minimizes fillStyle churn
    const flush = () => {
      if (!run) return;
      ctx.fillStyle = runColor ?? o.fg;
      ctx.fillText(run, x * charW, y * lineHeight);
      x += run.length;
      run = "";
    };
    for (let cx = 0; cx < line.length; cx++) {
      const ch = line[cx];
      const c = rowColors?.[cx] ?? null;
      const color = c ?? o.fg;
      if (color !== runColor) {
        flush();
        runColor = color;
      }
      run += ch;
    }
    flush();
  }
}

/** Convenience: pick a sane column count for a container. */
export function colsForWidth(widthPx: number, targetCharW = 8): number {
  return Math.max(24, Math.min(220, Math.round(widthPx / targetCharW)));
}

/**
 * Serialize an AsciiFrame to a plain-text artifact — the terminal-native
 * export format of the engine (ASCILINE's "canvas as typographic surface",
 * piped to a file). Pure text: no codec, no gpu, just glyphs.
 */
export function frameToText(
  frame: AsciiFrame,
  meta?: { label?: string; source?: string; mode?: string }
): string {
  const header = [
    "──────────────────────────────────────────────",
    " NEXUS ASCII EXPORT — phosphor frame dump",
    ` GRID      ${frame.cols}×${frame.rows} glyphs`,
    meta?.label ? ` LABEL     ${meta.label}` : null,
    meta?.mode ? ` MODE      ${meta.mode}` : null,
    meta?.source ? ` SOURCE    ${meta.source}` : null,
    ` STAMP     ${new Date().toISOString()}`,
    " ENGINE    renderAscii() · nexus redesign",
    "──────────────────────────────────────────────",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return `${header}\n\n${frame.lines.join("\n")}\n`;
}

/**
 * Serialize an AsciiFrame to a PNG "typographic print" — the same glyph grid
 * re-painted at print size onto an offscreen canvas with a phosphor palette
 * and a metadata footer strip. Async: resolves once toBlob() settles.
 */
export function frameToPngBlob(
  frame: AsciiFrame,
  meta?: { label?: string; mode?: string },
  o?: { fg?: string; bright?: string; bg?: string; fontSize?: number }
): Promise<Blob | null> {
  const fg = o?.fg ?? "#4ade80";
  const bright = o?.bright ?? "#d9ffe4";
  const bg = o?.bg ?? "#050a06";
  const fontSize = o?.fontSize ?? 14;

  const charW = fontSize * 0.6;
  const lineHeight = fontSize * 1.06;
  const pad = 28;
  const footerH = 44;
  const width = Math.ceil(frame.cols * charW + pad * 2);
  const height = Math.ceil(frame.rows * lineHeight + pad * 2 + footerH);

  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d");
  if (!ctx || !frame.lines.length) return Promise.resolve(null);

  // backdrop + subtle CRT vignette
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
  glow.addColorStop(0, "rgba(74, 222, 128, 0.045)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // glyphs — paint row by row (bright tint for the densest glyphs)
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";
  const dense = frame.cols > 160;
  for (let y = 0; y < frame.lines.length; y++) {
    const line = frame.lines[y];
    const rowColors = frame.colors[y];
    ctx.fillStyle = fg;
    let run = "";
    let runColor: string | null = fg;
    let x = 0;
    const flush = () => {
      if (!run) return;
      ctx.fillStyle = runColor ?? (dense ? fg : bright);
      ctx.fillText(run, pad + x * charW, pad + y * lineHeight);
      x += run.length;
      run = "";
    };
    for (let cx = 0; cx < line.length; cx++) {
      const ch = line[cx];
      const c = rowColors?.[cx] ?? null;
      // brightest glyphs get the "hot phosphor" tint
      const color = ch === "@" || ch === "%" || ch === "#" ? bright : (c ?? fg);
      if (color !== runColor) {
        flush();
        runColor = color;
      }
      run += ch;
    }
    flush();
  }

  // footer strip
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  ctx.fillStyle = "rgba(148, 224, 168, 0.25)";
  ctx.fillRect(pad, height - footerH - 8, width - pad * 2, 1);
  ctx.fillStyle = fg;
  ctx.font = `${Math.max(9, Math.round(fontSize * 0.62))}px monospace`;
  const metaBits = [
    "NEXUS ASCII PRINT",
    meta?.label ? `· ${meta.label}` : null,
    meta?.mode ? `· ${meta.mode}` : null,
    `· ${frame.cols}×${frame.rows} GLYPHS`,
    `· ${stamp} UTC`,
  ]
    .filter(Boolean)
    .join("  ");
  ctx.fillText(metaBits, pad, height - footerH + 6);

  return new Promise((resolve) => off.toBlob((b) => resolve(b), "image/png"));
}
