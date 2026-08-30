/**
 * ascii.ts — NEXUS glyph engine v2.
 *
 * Heavily inspired by ASCILINE (https://github.com/YusufB5/ASCILINE):
 * "turns the browser canvas into a typographic display surface" by mapping
 * pixel luminance/color to text glyphs. This is the static-image flavour of
 * that idea — the animated presets (rain / donut / wave) live in
 * components/ascii/ascii-canvas.tsx.
 *
 * v2 rendering pipeline (the crisp rewrite):
 *   1. fonts are resolved to REAL families — canvas ctx.font cannot resolve
 *      CSS var(), so the actual --font-geist-mono family list is read from
 *      computed style and the advance width is MEASURED, never assumed;
 *   2. sources are box-filtered through a supersampled offscreen canvas
 *      (default 3× the glyph grid) so every cell is a true area average —
 *      no single-point moiré;
 *   3. optional unsharp mask on the cell-luminance grid restores local
 *      contrast lost to downsampling (definition without haloing);
 *   4. paintAscii sizes canvases pixel-exactly from the measured metrics —
 *      frames are displayed 1:1 instead of being CSS-upscaled.
 *
 * v5 (weight-aware crispness):
 *   - monoMetrics(fontSize, weight) measures the SAME weight that
 *     paintAscii draws — bold mono advances differ from regular, and
 *     measuring one while painting the other smears runs;
 *   - paintAscii accepts fontWeight — bold glyphs carry far more ink per
 *     cell, which is what makes small ASCII renders read as "crisp".
 */

export type AsciiMode = "ascii" | "pixel" | "photo";

/** Character ramps, dark → bright (like ASCILINE's AsciiMapper). */
export const RAMPS = {
  /** compact classic ramp — good for display-sized renders */
  short: " .':-=+*#%@",
  /** phosphor-flavoured ramp with block glyphs (PIXEL mode) */
  blocks: " .·:;=+x%#@",
  /** 18-step tonal ramp — default for image renders: smooth but crisp */
  mid: " .,:;i!~=+*xoq#%@",
  /** classic donut.c luminance string (12 steps, bright → dense) */
  donut: ".,-~:;=!*#$@",
  /** high-detail 70-glyph ramp for very large canvases */
  detail:
    " .`':\",;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
} as const;

/* ------------------------------------------------------------------ */
/* font plumbing — the #1 crispness fix                                */
/* ------------------------------------------------------------------ */

const FALLBACK_STACK =
  "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace";

let resolvedStack: string | null = null;

/**
 * A ctx.font-usable font stack that actually contains the site's mono face.
 * canvas ignores var() inside font strings (silent no-op → 10px sans-serif),
 * so we read the resolved custom property once and append robust fallbacks.
 */
export function monoFontStack(): string {
  if (resolvedStack) return resolvedStack;
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-geist-mono")
      .trim();
    resolvedStack = v ? `${v}, ${FALLBACK_STACK}` : FALLBACK_STACK;
  } catch {
    resolvedStack = FALLBACK_STACK;
  }
  return resolvedStack;
}

export interface MonoMetrics {
  /** real advance width of one glyph cell in CSS px */
  charW: number;
  /** line height in CSS px (1.05em — matches the paint row stride) */
  lineH: number;
}

const metricsCache = new Map<string, MonoMetrics>();
let fontsRehooked = false;

/**
 * MEASURED monospace cell metrics for a given px size (cached).
 * Assumed 0.6em advances are what made v1 renders fuzzy — real fonts
 * differ by a few percent, and 60 columns of accumulated drift smears text.
 *
 * v5: weight-aware — bold mono can carry a different advance than regular,
 * and measuring one weight while painting another re-introduces drift.
 * The cache key now includes the weight.
 */
export function monoMetrics(fontSize: number, weight: string | number = 400): MonoMetrics {
  const size = Math.max(3, Math.round(fontSize * 100) / 100);
  const key = `${weight}@${size}`;
  const hit = metricsCache.get(key);
  if (hit) return hit;

  let m: MonoMetrics = { charW: size * 0.6, lineH: size * 1.05 };
  try {
    const off = document.createElement("canvas");
    const ctx = off.getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${size}px ${monoFontStack()}`;
      const w = ctx.measureText("0123456789mwMW@#%").width / 16;
      if (w > 0) m = { charW: w, lineH: Math.round(size * 105) / 100 };
    }
  } catch {
    /* keep the classic 0.6 estimate */
  }
  metricsCache.set(key, m);

  // webfont finished loading after we measured? drop the cache so the next
  // render re-measures with the real face (one-shot hook)
  if (!fontsRehooked) {
    fontsRehooked = true;
    try {
      void document.fonts?.ready.then(() => metricsCache.clear());
    } catch {
      /* no fonts API — estimates stay */
    }
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* render — supersampled box filter → tonal grid → glyphs              */
/* ------------------------------------------------------------------ */

/**
 * 4×4 ordered-dither matrix (Bayer), normalized 0..1 — mean 0.46875.
 * Added (zero-mean) to the cell luminance just before glyph quantization,
 * it trades tonal banding for spatial detail: flat midtones become
 * structured glyph texture instead of mud. This is the single biggest
 * perceived-clarity win for ASCII images after sampling quality.
 */
const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map((v) => v / 16);

export interface AsciiRenderOptions {
  /** number of character columns */
  cols: number;
  /**
   * explicit row count (exact-fit renders). When omitted, rows derive from
   * the source aspect and the cell aspect so frames stay undistorted.
   */
  rows?: number;
  /** glyph ramp to use */
  ramp?: string;
  /** render mode: ascii glyphs / colored blocks / plain photo passthrough */
  mode?: AsciiMode;
  /** darken shadows for CRT feel (0..1) */
  gamma?: number;
  /** invert ramp mapping */
  invert?: boolean;
  /** color the glyphs with the source pixel color (ascii mode) */
  colorize?: boolean;
  /**
   * binary cutoff (0..1) — when set, output collapses to ramp[0] / ramp[last]
   * around this luminance. Perfect for block-letter text banners.
   */
  binary?: number;
  /**
   * percentile-based histogram stretch (default true) — rescues dark/flat
   * sources by remapping the 2nd..98th luminance percentiles to 0..1
   */
  autoLevels?: boolean;
  /**
   * box-filter supersample factor (1..4, default 3). Each glyph cell is the
   * average of an SS×SS block — kills the single-point sampling moiré that
   * made v1 renders sparkle inaccurately.
   */
  supersample?: number;
  /**
   * unsharp-mask amount (0..1, default 0) on the cell-luminance grid —
   * restores the local contrast that downsampling softens. 0.3–0.5 reads
   * as "defined" without halos.
   */
  sharpen?: number;
  /**
   * ordered-dither strength (0..1, default 0) — 1 adds a full glyph step of
   * Bayer threshold noise before quantization. Kills tonal banding in flat
   * areas (skies, walls) and raises perceived resolution; 0.5–0.8 is the
   * sweet spot for photographic sources.
   */
  dither?: number;
  /** glyph-cell aspect (charW/lineH); defaults to measured mono metrics */
  cellAspect?: number;
}

export interface AsciiFrame {
  /** one string per row */
  lines: string[];
  /** per-cell color (css string), only when colorize/pixel */
  colors: (string | null)[][];
  cols: number;
  rows: number;
}

function sourceDims(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): { sw: number; sh: number } {
  if ("naturalWidth" in source) return { sw: source.naturalWidth, sh: source.naturalHeight };
  if ("videoWidth" in source) return { sw: source.videoWidth, sh: source.videoHeight };
  return { sw: source.width, sh: source.height };
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

/** 3×3 gaussian-ish blur used by the unsharp pass (clamp-edge). */
function blur3(src: Float32Array, cols: number, rows: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < rows; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y < rows - 1 ? y + 1 : rows - 1;
    for (let x = 0; x < cols; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x < cols - 1 ? x + 1 : cols - 1;
      const s =
        2 * src[y * cols + x] +
        (src[y * cols + x0] + src[y * cols + x2] +
          src[y0 * cols + x] + src[y2 * cols + x]) * 0.75 +
        (src[y0 * cols + x0] + src[y0 * cols + x2] +
          src[y2 * cols + x0] + src[y2 * cols + x2]) * 0.25;
      out[y * cols + x] = s / 5;
    }
  }
  return out;
}

/**
 * Render an image (or canvas/video) into an AsciiFrame.
 * Pipeline: supersampled box downsample → auto-levels → gamma → unsharp →
 * glyph map. Mirrors ASCILINE's mapper, with a broadcast-grade front end.
 */
export function renderAscii(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  opts: AsciiRenderOptions
): AsciiFrame {
  const cols = Math.max(8, Math.floor(opts.cols));
  const mode = opts.mode ?? "ascii";
  const ramp = opts.ramp ?? RAMPS.mid;
  const gamma = opts.gamma ?? 0.9;
  const invert = opts.invert ?? false;
  const colorize = opts.colorize ?? false;

  const { sw, sh } = sourceDims(source);
  if (!sw || !sh) return { lines: [], colors: [], cols: 0, rows: 0 };

  const cellAspect =
    opts.cellAspect ?? (() => {
      const m = monoMetrics(10);
      return m.charW / m.lineH;
    })();
  const rows =
    opts.rows != null
      ? Math.max(4, Math.floor(opts.rows))
      : Math.max(4, Math.round(cols * (sh / sw) * cellAspect));

  // ---- supersampled box-filter sampling ----
  const SS = Math.max(1, Math.min(4, Math.round(opts.supersample ?? 3)));
  const sampW = cols * SS;
  const sampH = rows * SS;

  const off = document.createElement("canvas");
  off.width = sampW;
  off.height = sampH;
  const sctx = off.getContext("2d", { willReadFrequently: true });
  if (!sctx) return { lines: [], colors: [], cols: 0, rows: 0 };
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(source, 0, 0, sampW, sampH);

  let raw: Uint8ClampedArray;
  try {
    raw = sctx.getImageData(0, 0, sampW, sampH).data;
  } catch {
    return { lines: [], colors: [], cols: 0, rows: 0 };
  }

  // per-cell area average (alpha-weighted luminance + rgb)
  const lum = new Float32Array(cols * rows);
  const rgb = new Float32Array(cols * rows * 3);
  const invN = 1 / (SS * SS);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let l = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        const sy = y * SS + dy;
        for (let dx = 0; dx < SS; dx++) {
          const i = ((sy * sampW) + x * SS + dx) * 4;
          const a = raw[i + 3] / 255;
          l += (0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2]) / 255 * a;
          r += raw[i] * a;
          g += raw[i + 1] * a;
          b += raw[i + 2] * a;
        }
      }
      const idx = y * cols + x;
      lum[idx] = l * invN;
      rgb[idx * 3] = r * invN;
      rgb[idx * 3 + 1] = g * invN;
      rgb[idx * 3 + 2] = b * invN;
    }
  }

  // ---- auto-levels: luminance histogram stretch (2%..98%) ----
  let lo = 0;
  let hi = 1;
  if (opts.autoLevels !== false) {
    const hist = new Uint32Array(256);
    let opaque = 0;
    for (let i = 0; i < lum.length; i++) {
      hist[Math.min(255, Math.round(lum[i] * 255))]++;
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
  for (let i = 0; i < lum.length; i++) {
    lum[i] = Math.pow(Math.min(1, Math.max(0, (lum[i] - lo) / span)), gamma);
    if (invert) lum[i] = 1 - lum[i];
  }

  // ---- unsharp mask: definition pass ----
  if (opts.sharpen && opts.sharpen > 0) {
    const blur = blur3(lum, cols, rows);
    const amt = Math.min(1, opts.sharpen);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = Math.min(1, Math.max(0, lum[i] + amt * (lum[i] - blur[i])));
    }
  }

  // ---- glyph mapping (Bayer ordered dithering happens right here, so it
  // aligns with the quantizer and skips the binary-cutoff path) ----
  const lines: string[] = [];
  const colors: (string | null)[][] = [];
  const n = ramp.length - 1;
  const ditherStep = opts.dither && opts.dither > 0 ? opts.dither / n : 0;

  for (let y = 0; y < rows; y++) {
    let line = "";
    const rowColors: (string | null)[] = [];
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      let v = lum[idx];
      if (ditherStep > 0) {
        v += (BAYER4[(y & 3) * 4 + (x & 3)] - 0.46875) * ditherStep;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
      }
      if (mode === "pixel") {
        // colored block glyph █ — the "--pixel" flag of ASCILINE
        const gi = v < 0.08 ? 0 : Math.max(1, Math.round(v * n));
        line += gi === 0 ? " " : "█";
        rowColors.push(
          gi === 0
            ? null
            : toCss(rgb[idx * 3], rgb[idx * 3 + 1], rgb[idx * 3 + 2], 1.12)
        );
      } else if (opts.binary != null) {
        line += v >= opts.binary ? ramp[n] : ramp[0];
        rowColors.push(null);
      } else {
        const gi = Math.round(v * n);
        line += ramp[gi];
        rowColors.push(
          colorize && gi > 0
            ? toCss(rgb[idx * 3], rgb[idx * 3 + 1], rgb[idx * 3 + 2], 1.35)
            : null
        );
      }
    }
    lines.push(line);
    colors.push(rowColors);
  }

  return { lines, colors, cols, rows };
}

/* ------------------------------------------------------------------ */
/* paint — measured metrics, pixel-exact canvases, two-tone pop        */
/* ------------------------------------------------------------------ */

/** glyphs dense enough to get the "hot phosphor" tint */
const BRIGHT_CHARS = "@#%&8BWM";

/**
 * Paint an AsciiFrame onto a visible canvas with phosphor styling.
 * Returns the CSS-pixel size of the painted grid — size the host element
 * from it (or leave the canvas stretched by ≤ half a glyph; invisible).
 */
export function paintAscii(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame,
  o: {
    fg: string;
    bg?: string | null;
    bright?: string;
    fontSize?: number;
    /** glyph weight — must match the monoMetrics() weight used for the grid */
    fontWeight?: string | number;
    dpr?: number;
    /** override measured metrics (already-normalized cells) */
    charW?: number;
    lineH?: number;
  }
): { width: number; height: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx || !frame.lines.length) return { width: 0, height: 0 };
  const dpr = Math.min(3, Math.max(1, o.dpr ?? (window.devicePixelRatio || 1)));
  const fontSize = o.fontSize ?? 10;
  const weight = o.fontWeight ?? 400;
  const m = monoMetrics(fontSize, weight);
  const charW = o.charW ?? m.charW;
  const lineHeight = o.lineH ?? m.lineH;

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

  ctx.font = `${weight} ${fontSize}px ${monoFontStack()}`;
  ctx.textBaseline = "top";

  const bright = o.bright ?? null;
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
      // densest glyphs pop with the hot-phosphor tint — adds definition
      const color =
        c ?? (bright && BRIGHT_CHARS.includes(ch) ? bright : o.fg);
      if (color !== runColor) {
        flush();
        runColor = color;
      }
      run += ch;
    }
    flush();
  }

  return { width, height };
}

/** Convenience: pick a sane column count for a container. */
export function colsForWidth(widthPx: number, targetCharW = 8): number {
  return Math.max(24, Math.min(240, Math.round(widthPx / targetCharW)));
}

/**
 * Text → AsciiFrame: typeset a string LARGE onto an offscreen canvas (≈480px
 * wide) and let renderAscii downsample it into glyph space — same pipeline as
 * the gallery stills. Long titles word-wrap so every letter keeps enough
 * columns to stay legible; strokes are thickened via strokeText and a high
 * gamma crushes antialias fuzz. (canvas ctx.font cannot resolve CSS var() —
 * use explicit system stacks.)
 */
export function textToAsciiFrame(
  text: string,
  opts?: { cols?: number; weight?: string; maxLineChars?: number }
): AsciiFrame {
  const cols = Math.max(24, Math.min(160, opts?.cols ?? 110));
  const weight = opts?.weight ?? "800";
  const maxChars = opts?.maxLineChars ?? 16;
  const fontStack = `${weight} 48px Arial, 'Helvetica Neue', 'Liberation Sans', sans-serif`;

  // word-wrap so each line keeps enough glyph columns per letter
  const words = text.toUpperCase().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) return { lines: [], colors: [], cols: 0, rows: 0 };

  // hi-res typeset surface — the longest line defines the scale
  const W = 480;
  const off = document.createElement("canvas");
  const ctx = off.getContext("2d");
  if (!ctx) return { lines: [], colors: [], cols: 0, rows: 0 };

  ctx.font = fontStack;
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  const refW = Math.max(1, ctx.measureText(longest).width);
  const fontSize = Math.max(10, Math.min(48, (48 * (0.92 * W)) / refW));
  const lineH = fontSize * 1.22;
  const H = Math.ceil(lineH * lines.length + fontSize * 0.4);

  off.width = W;
  off.height = H;
  ctx.font = fontStack;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, fontSize * 0.07);
  ctx.lineJoin = "round";
  lines.forEach((line, i) => {
    const y = fontSize * 0.25 + lineH * (i + 0.5);
    ctx.fillText(line, W / 2, y);
    ctx.strokeText(line, W / 2, y);
  });

  // downsample into glyph space; binary cutoff → chunky block-letter glyphs
  return renderAscii(off, {
    cols,
    ramp: "# ",
    mode: "ascii",
    gamma: 1,
    binary: 0.42,
    supersample: 3,
  });
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
    " ENGINE    renderAscii() v2 · nexus redesign",
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

  const m = monoMetrics(fontSize);
  const charW = m.charW;
  const lineHeight = m.lineH;
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
  ctx.font = `${fontSize}px ${monoFontStack()}`;
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
      const color = c ?? (BRIGHT_CHARS.includes(ch) ? bright : null);
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
  ctx.font = `${Math.max(9, Math.round(fontSize * 0.62))}px ${monoFontStack()}`;
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
