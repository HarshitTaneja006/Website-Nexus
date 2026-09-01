"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bomb, Download, FileImage, Pause, Play, Sparkles, Type } from "lucide-react";
import {
  frameToPngBlob,
  frameToText,
  monoFontStack,
  monoMetrics,
  type AsciiFrame,
} from "@/lib/ascii";
import { useReveal } from "@/components/site/use-reveal";
import { useToast } from "@/hooks/use-toast";

/**
 * GlyphForge — the scroll-flight's replacement, improvised around one idea:
 * the club's words are not written, they are FORGED from glyphs.
 *
 * A field of ~2k glyph particles lives on a terminal grid and cycles through
 * three acts (no scroll-jacking, no sticky, no video — nothing browser-
 * specific, which is exactly why the old flight was dropped):
 *
 *   FORGE   — every particle springs toward a cell of the current word
 *             (rasterized offscreen, sampled at glyph resolution; edge cells
 *             get light glyphs, the interior gets dense hot ones);
 *   HOLD    — the word breathes while assembled;
 *   SCATTER — a curl-ish flow field blasts the field apart and the next
 *             word condenses out of the chaos.
 *
 * Interactivity is the point: the pointer is a physical stirrer (particles
 * flee it), clicking fires a shockwave, typing a word re-casts the field
 * around YOUR text, and D/P are global keys. The whole frame is exportable
 * (.txt glyph dump / .png typographic print) like every other NEXUS engine.
 *
 * Engine notes:
 * - physics runs in CELL space (floats, cells/second); painting snaps to the
 *   grid and writes into a brightness/char buffer — the same run-length
 *   grouped fillText strategy as the hero engine (~4 fillStyle per row);
 * - particle speed maps to a 4-bucket heat palette (cool phosphor → hot
 *   amber), so motion itself becomes the shading;
 * - HUD state is React but updated at ~4 Hz from refs — zero re-renders per
 *   physics frame;
 * - prefers-reduced-motion: no loop; the field settles into one static
 *   assembled frame, controls still re-forge on demand.
 */

type Phase = "forge" | "hold" | "scatter";

const DEFAULT_WORDS = ["INNOVATE", "LEAD", "BUILD", "NEXUS", "SHIP IT"];
const DOMAIN_CHIPS = ["AI/ML", "WEB", "MOBILE", "CLOUD", "DEVTOOLS"];

/** per-particle glyph vocabulary */
const EDGE_CHARS = "·:=+*";
const CORE_CHARS = "x%#@&8";
const DUST_CHARS = "01<>[]{}#$%&*+=/\\|;:~^";

/** painter/dump palette — index-parallel with HEAT colors per cell */
const PARTICLE_CHARS: string[] = [
  ...DUST_CHARS.split(""),
  ...EDGE_CHARS.split(""),
  ...CORE_CHARS.split(""),
];
const charIndexOf = (ch: string) => Math.max(0, PARTICLE_CHARS.indexOf(ch));

/** heat buckets (by cell brightness): dim phosphor → white-hot */
const HEAT_COLORS = [
  "rgba(96,165,250,0.38)",
  "rgba(96,165,250,0.78)",
  "rgba(147,197,253,0.92)",
  "rgba(253,230,138,0.95)",
];
const heatIndex = (b: number) => (b < 0.28 ? 0 : b < 0.55 ? 1 : b < 0.85 ? 2 : 3);

const PHASE_DUR: Record<Phase, number> = { forge: 2.0, hold: 2.6, scatter: 1.7 };
const PHASE_LABEL: Record<Phase, string> = {
  forge: "FORGING",
  hold: "HOLDING",
  scatter: "SCATTERED",
};

interface Target {
  x: number; // cell coords
  y: number;
  ch: string;
}

interface Particle {
  x: number; // cell-space floats
  y: number;
  vx: number; // cells / second
  vy: number;
  tx: number; // target cell (-1 = drifter)
  ty: number;
  ci: number; // index into PARTICLE_CHARS
}

export function GlyphForge() {
  const { ref: revealRef, seen } = useReveal<HTMLDivElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detonateRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  const [word, setWord] = useState("");
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({
    phase: "forge" as Phase,
    word: DEFAULT_WORDS[0],
    particles: 0,
    fps: 60,
    grid: "—",
  });

  // engine-only state — refs, never re-rendered per frame
  const engine = useRef({
    paused: false,
    phase: "forge" as Phase,
    phaseT: 0,
    wordIdx: 0,
    custom: null as string | null,
    cols: 0,
    rows: 0,
    dpr: 1,
    fontSize: 10,
    charW: 6,
    lineH: 10.5,
    particles: [] as Particle[],
    cellB: new Float32Array(0),
    cellC: new Int16Array(0).fill(-1),
    pointer: { x: -1, y: -1, down: false },
    visible: true,
    running: true,
    fpsEma: 60,
    reduced: false,
    t: 0,
  });

  /* ------------------------------------------------------------------ */
  /* word → targets (offscreen raster sampled at glyph resolution)      */
  /* ------------------------------------------------------------------ */

  const sampleWord = useCallback((text: string): Target[] => {
    const e = engine.current;
    const { cols, rows } = e;
    if (!cols || !rows) return [];
    const S = 8; // raster px per glyph cell — supersampled for AA edges
    const W = cols * S;
    const H = rows * S;
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // canvas ctx.font cannot resolve CSS var() — explicit heavy sans stack.
    // NOTE the weight MUST precede the size in a ctx.font string ("900 48px
    // Arial"), so the stack is applied via setFont() — a pre-weighted stack
    // concatenated after the size ("48px 900 Arial") is silently INVALID and
    // canvas falls back to 10px sans (the "PARTICLES: 0" bug).
    const setFont = (fs: number) => {
      ctx.font = `900 ${fs}px Arial, 'Helvetica Neue', 'Liberation Sans', sans-serif`;
    };

    // width of a line when drawn per-letter with explicit tracking —
    // per-letter advance + pad keeps inter-letter gaps alive at glyph-cell
    // resolution (plain fillText kerning merges letters into blobs)
    const trackOf = (fs: number) => fs * 0.12;
    const lineWidth = (ln: string, fs: number) => {
      setFont(fs);
      let w = 0;
      for (const ch of ln) w += ctx.measureText(ch).width + trackOf(fs);
      return w - trackOf(fs);
    };
    const fitFs = (ls: string[]) => {
      let f = Math.floor(H * 0.78);
      while (f > 8 && Math.max(...ls.map((l) => lineWidth(l, f))) > W * 0.9) {
        f = Math.floor(f * 0.94);
      }
      return f;
    };

    // wrap decision is measured, not heuristic: keep whichever layout
    // (single line vs a two-line split) ends up with the taller font
    let lines = [text];
    if (text.includes(" ")) {
      const words = text.split(" ");
      const a = words[0];
      const b = words.slice(1).join(" ");
      if (b) {
        const wrapped = [a, b];
        if (fitFs(wrapped) > fitFs(lines)) lines = wrapped;
      }
    }

    // shrink-to-fit, starting tall — tall letters read best on a grid
    let fs = fitFs(lines);

    const track = trackOf(fs);
    setFont(fs);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    const lineH = fs * 1.12;
    const startY = Math.max(fs * 0.75, (H - lineH * lines.length) / 2 + fs * 0.62);
    lines.forEach((ln, i) => {
      const w = lineWidth(ln, fs);
      let x = W / 2 - w / 2;
      const y = startY + i * lineH;
      for (const ch of ln) {
        const cw = ctx.measureText(ch).width;
        ctx.fillText(ch, x + cw / 2, y);
        x += cw + track;
      }
    });

    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, W, H).data;
    } catch {
      return [];
    }

    // per-cell luminance (box average of the S×S block)
    const lum = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let acc = 0;
        for (let dy = 0; dy < S; dy++) {
          const rowOff = (y * S + dy) * W + x * S;
          for (let dx = 0; dx < S; dx++) acc += data[(rowOff + dx) * 4];
        }
        lum[y * cols + x] = acc / (S * S * 255);
      }
    }

    // filled cells → targets; edges get light glyphs, core gets dense ones
    const targets: Target[] = [];
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= cols || y >= rows ? 0 : lum[y * cols + x];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const l = lum[y * cols + x];
        if (l < 0.45) continue;
        const edge =
          at(x - 1, y) < 0.45 ||
          at(x + 1, y) < 0.45 ||
          at(x, y - 1) < 0.45 ||
          at(x, y + 1) < 0.45;
        const h = (x * 7 + y * 13) % 97;
        const ch = edge
          ? EDGE_CHARS[Math.min(EDGE_CHARS.length - 1, Math.floor(l * 5) + (h % 2))]
          : CORE_CHARS[h % CORE_CHARS.length];
        targets.push({ x, y, ch });
      }
    }
    return targets;
  }, []);

  /** (re)cast the field around a word — called by the cycle and by the UI */
  const forgeWord = useCallback(
    (text: string) => {
      const e = engine.current;
      const targets = sampleWord(text);
      if (!targets.length) return;
      // grow the field: TWO particles per target cell (oversampled strike —
      // if one jitters off its cell the other still marks it) capped for perf
      const want = Math.max(e.particles.length, Math.min(4600, targets.length * 2));
      const ps = e.particles;
      while (ps.length < want) {
        ps.push({
          x: Math.random() * e.cols,
          y: Math.random() * e.rows,
          vx: 0,
          vy: 0,
          tx: -1,
          ty: -1,
          ci: charIndexOf(DUST_CHARS[(Math.random() * DUST_CHARS.length) | 0]),
        });
      }
      // assign: pairs of particles share each target; the leftovers keep
      // drifting as ambient dust
      const start = (Math.random() * targets.length) | 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (i < targets.length * 2) {
          const t = targets[(start + (i >> 1)) % targets.length];
          p.tx = t.x;
          p.ty = t.y;
          p.ci = charIndexOf(t.ch);
        } else {
          p.tx = -1;
          p.ty = -1;
          p.ci = charIndexOf(DUST_CHARS[(Math.random() * DUST_CHARS.length) | 0]);
        }
      }
      e.phase = "forge";
      e.phaseT = 0;
      setHud((h) => ({ ...h, phase: "forge", word: text, particles: ps.length }));
    },
    [sampleWord]
  );

  /* ------------------------------------------------------------------ */
  /* engine loop                                                        */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const e = engine.current;
    e.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fontSizeFor = (w: number) => (w < 480 ? 8 : w < 900 ? 9 : 10);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(120, rect.width);
      const h = Math.max(120, rect.height);
      e.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * e.dpr);
      canvas.height = Math.round(h * e.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // density scales with viewport — small screens get chunkier cells
      e.fontSize = fontSizeFor(w);
      const m = monoMetrics(e.fontSize);
      e.charW = m.charW;
      e.lineH = m.lineH;
      e.cols = Math.floor(w / e.charW);
      e.rows = Math.floor(h / e.lineH);
      e.cellB = new Float32Array(e.cols * e.rows);
      e.cellC = new Int16Array(e.cols * e.rows).fill(-1);
      // respawn field — re-forge the current word into the new grid
      e.particles = [];
      forgeWord(e.custom ?? DEFAULT_WORDS[e.wordIdx % DEFAULT_WORDS.length]);
    };

    const detonate = () => {
      e.phase = "scatter";
      e.phaseT = 0;
      // radial impulse from the field center — instant chaos
      const cx = e.cols / 2;
      const cy = e.rows / 2;
      for (const p of e.particles) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.max(2, Math.hypot(dx, dy));
        const f = 700 / (d + 6);
        p.vx += (dx / d) * f + (Math.random() - 0.5) * 60;
        p.vy += (dy / d) * f + (Math.random() - 0.5) * 60;
      }
      setHud((h) => ({ ...h, phase: "scatter" }));
    };
    detonateRef.current = detonate;

    /* ---------------- painting (run-length grouped fillText) -------- */
    const paint = () => {
      const { cols, rows, charW, lineH, dpr, cellB, cellC } = e;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * charW, rows * lineH);
      ctx.font = `${e.fontSize}px ${monoFontStack()}`;
      ctx.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        const rowOff = y * cols;
        let open = false;
        let runStart = 0;
        let runColor = "";
        const flush = (endX: number) => {
          if (!open) return;
          ctx.fillStyle = runColor;
          let s = "";
          for (let x = runStart; x < endX; x++) {
            const ci = cellC[rowOff + x];
            s += ci >= 0 ? PARTICLE_CHARS[ci] ?? " " : " ";
          }
          ctx.fillText(s, runStart * charW, y * lineH);
          open = false;
        };
        for (let x = 0; x < cols; x++) {
          const idx = rowOff + x;
          if (cellC[idx] < 0) {
            flush(x);
            continue;
          }
          const color = HEAT_COLORS[heatIndex(cellB[idx])];
          if (!open) {
            open = true;
            runStart = x;
            runColor = color;
          } else if (color !== runColor) {
            flush(x);
            open = true;
            runStart = x;
            runColor = color;
          }
        }
        flush(cols);
      }
    };

    /* ---------------- physics tick (dt-based, cells/second) --------- */
    // damped-spring constants (ω²  and 2ζω): forge is under-damped (a hot
    // overshoot on arrival), hold is OVER-damped so glyphs park dead-center
    const SPRING = { forge: [110, 15], hold: [85, 21] } as const;

    const tick = (dt: number) => {
      const { cols, rows, pointer } = e;
      e.t += dt;
      e.phaseT += dt;
      const t = e.t;

      // phase machine
      if (e.phase === "forge" && e.phaseT > PHASE_DUR.forge) {
        e.phase = "hold";
        e.phaseT = 0;
        setHud((h) => ({ ...h, phase: "hold" }));
      } else if (e.phase === "hold" && e.phaseT > PHASE_DUR.hold) {
        detonate();
      } else if (e.phase === "scatter" && e.phaseT > PHASE_DUR.scatter) {
        e.custom = null;
        e.wordIdx = (e.wordIdx + 1) % DEFAULT_WORDS.length;
        forgeWord(DEFAULT_WORDS[e.wordIdx]);
        setWord("");
      }

      const forging = e.phase === "forge";
      const holding = e.phase === "hold";
      const [w2, z2w] = SPRING[holding ? "hold" : "forge"];
      const px = pointer.x;
      const py = pointer.y;
      const hasPointer = px >= 0;
      const stir = pointer.down ? 2.2 : 1;
      const dampFlow = Math.pow(0.33, dt);

      const cellB = e.cellB;
      const cellC = e.cellC;
      cellB.fill(0);
      cellC.fill(-1);

      for (const p of e.particles) {
        const anchored = p.tx >= 0 && (forging || holding);

        if (anchored) {
          // damped spring toward the target cell — under-damped enough to
          // overshoot a hair (molten metal settling into the mold)
          p.vx += ((p.tx + 0.5 - p.x) * w2 - p.vx * z2w) * dt;
          p.vy += ((p.ty + 0.5 - p.y) * w2 - p.vy * z2w) * dt;
          if (holding) {
            // barely-there shimmer while the word is assembled — crisp first
            p.vx += (Math.random() - 0.5) * 4 * dt;
            p.vy += (Math.random() - 0.5) * 4 * dt;
          }
        } else {
          // curl-ish flow field — layered sines, cheap and smooth
          const a =
            Math.sin(p.x * 0.11 + t * 0.9) +
            Math.cos(p.y * 0.13 - t * 0.7) +
            Math.sin((p.x + p.y) * 0.05 + t * 0.42) * 1.4;
          const drift = p.tx >= 0 ? 46 : 26; // scattered word particles fly harder
          p.vx += Math.cos(a * 1.7) * drift * dt;
          p.vy += Math.sin(a * 1.7) * drift * dt;
          p.vx *= dampFlow;
          p.vy *= dampFlow;
          // wrap the field edges so drifters never escape
          if (p.x < -2) p.x += cols + 4;
          else if (p.x > cols + 2) p.x -= cols + 4;
          if (p.y < -2) p.y += rows + 4;
          else if (p.y > rows + 2) p.y -= rows + 4;
        }

        // pointer repulsion — the stirrer (y weighted: cells are tall)
        if (hasPointer) {
          const dx = p.x - px;
          const dy = (p.y - py) * 1.9;
          const d2 = dx * dx + dy * dy;
          const R = pointer.down ? 13 : 9;
          if (d2 < R * R) {
            const d = Math.max(0.5, Math.sqrt(d2));
            const f = (1 - d / R) * (pointer.down ? 2600 : 900) * stir;
            p.vx += (dx / d) * f * dt;
            p.vy += (dy / d) * f * dt;
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // paint into the cell buffer — brighter (faster) wins the cell
        const cx = Math.round(p.x);
        const cy = Math.round(p.y);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const idx = cy * cols + cx;
        const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 34);
        const b = anchored ? 0.62 + speed * 0.38 : 0.1 + speed * 0.85;
        if (b > cellB[idx]) {
          cellB[idx] = b;
          cellC[idx] = p.ci;
        }
      }
      paint();
    };

    /* ---------------- loop / lifecycle ---------------- */
    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (e.paused || !e.visible || !e.running) return;
      e.fpsEma = e.fpsEma * 0.95 + (1 / Math.max(dt, 1 / 240)) * 0.05;
      tick(dt);
      hudAcc += dt;
      if (hudAcc > 0.25) {
        hudAcc = 0;
        setHud((h) => ({
          ...h,
          phase: e.phase,
          particles: e.particles.length,
          fps: Math.round(e.fpsEma),
          grid: `${e.cols}×${e.rows}`,
        }));
      }
    };

    // reduced motion: settle the spring with a burst of fixed steps, then
    // paint exactly one assembled frame — no loop at all
    const settleStatic = () => {
      for (let i = 0; i < 90; i++) tick(1 / 30);
      paint();
    };

    resize();
    if (e.reduced) settleStatic();
    else raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      if ((ro as ResizeObserver & { _t?: number })._t != null) return;
      (ro as ResizeObserver & { _t?: number })._t = window.setTimeout(() => {
        (ro as ResizeObserver & { _t?: number })._t = undefined;
        resize();
        if (e.reduced) settleStatic();
      }, 200);
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        e.visible = entry.isIntersecting;
        last = performance.now();
      },
      { threshold: 0.05 }
    );
    io.observe(wrap);

    const onVis = () => {
      e.running = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    // pointer — the stirrer; a click also fires a one-shot shockwave
    const cellFromEvent = (ev: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const m = monoMetrics(fontSizeFor(rect.width));
      return {
        x: (ev.clientX - rect.left) / m.charW,
        y: (ev.clientY - rect.top) / m.lineH,
      };
    };
    const onMove = (ev: PointerEvent) => {
      const c = cellFromEvent(ev);
      e.pointer.x = c.x;
      e.pointer.y = c.y;
    };
    const onDown = (ev: PointerEvent) => {
      const c = cellFromEvent(ev);
      e.pointer.x = c.x;
      e.pointer.y = c.y;
      if (e.pointer.down) return;
      e.pointer.down = true;
      if (e.reduced) return; // no motion for reduced-motion users
      for (const p of e.particles) {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.max(1.5, Math.hypot(dx, dy));
        if (d < 16) {
          const f = (1 - d / 16) * 130;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }
    };
    const onUp = () => (e.pointer.down = false);
    const onLeave = () => {
      e.pointer.x = -1;
      e.pointer.y = -1;
      e.pointer.down = false;
    };
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointerleave", onLeave);

    // site-wide keys (D detonate / P pause) — ignored while typing
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return;
      const tg = ev.target as HTMLElement | null;
      if (
        tg &&
        (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.tagName === "SELECT" || tg.isContentEditable)
      ) {
        return;
      }
      if (ev.key === "d" || ev.key === "D") detonate();
      else if (ev.key === "p" || ev.key === "P") setPaused((v) => !v);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      detonateRef.current = null;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
    };
  }, [forgeWord]);

  // pause flag → engine ref
  useEffect(() => {
    engine.current.paused = paused;
  }, [paused]);

  /* ------------------------------------------------------------------ */
  /* controls + frame dump                                              */
  /* ------------------------------------------------------------------ */

  const submitWord = useCallback(() => {
    const w = word.trim().toUpperCase().replace(/\s+/g, " ").slice(0, 14);
    if (!w) {
      toast({ title: "TYPE A WORD FIRST", description: "the forge needs something to cast" });
      return;
    }
    engine.current.custom = w;
    forgeWord(w);
    toast({ title: "FORGING", description: `"${w}" — watch the field re-cast` });
  }, [word, forgeWord, toast]);

  const castChip = useCallback(
    (d: string) => {
      engine.current.custom = d;
      forgeWord(d);
    },
    [forgeWord]
  );

  const buildFrame = useCallback((): AsciiFrame | null => {
    const e = engine.current;
    if (!e.cols || !e.rows) return null;
    const lines: string[] = [];
    const colors: (string | null)[][] = [];
    for (let y = 0; y < e.rows; y++) {
      let line = "";
      const row: (string | null)[] = [];
      for (let x = 0; x < e.cols; x++) {
        const idx = y * e.cols + x;
        const ci = e.cellC[idx];
        if (ci < 0) {
          line += " ";
          row.push(null);
        } else {
          line += PARTICLE_CHARS[ci] ?? "?";
          row.push(HEAT_COLORS[heatIndex(e.cellB[idx])]);
        }
      }
      lines.push(line);
      colors.push(row);
    }
    return { lines, colors, cols: e.cols, rows: e.rows };
  }, []);

  const dumpTxt = useCallback(() => {
    const frame = buildFrame();
    if (!frame || !frame.lines.length) return;
    const label = `FOUNDRY_${hud.word.replace(/\s+/g, "_") || "FORGE"}`;
    const text = frameToText(frame, { label, mode: "FORGE" });
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-foundry-${hud.word.toLowerCase().replace(/\s+/g, "-") || "forge"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "FRAME DUMPED", description: `${frame.cols}×${frame.rows} glyphs → .txt` });
  }, [buildFrame, hud.word, toast]);

  const dumpPng = useCallback(() => {
    const frame = buildFrame();
    if (!frame || !frame.lines.length) return;
    const label = `FOUNDRY_${hud.word.replace(/\s+/g, "_") || "FORGE"}`;
    void frameToPngBlob(frame, { label, mode: "FORGE" }).then((blob) => {
      if (!blob) {
        toast({ title: "PRINT FAILED", description: "encoder returned nothing", variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-foundry-${hud.word.toLowerCase().replace(/\s+/g, "-") || "forge"}.print.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PRINT SPOOLED", description: `${frame.cols}×${frame.rows} glyphs → .png` });
    });
  }, [buildFrame, hud.word, toast]);

  const phasePct = Math.min(100, (engine.current.phaseT / PHASE_DUR[hud.phase]) * 100);

  return (
    <section id="forge" className="relative border-b border-border/60 bg-[#060a12]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div ref={revealRef} className={`reveal ${seen ? "is-visible" : ""}`}>
          {/* header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-primary">01 / GLYPH FOUNDRY</p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                The Glyph Foundry
              </h2>
            </div>
            <p className="max-w-sm font-mono text-[10px] leading-relaxed tracking-wider text-muted-foreground">
              THE FLIGHT IS GROUNDED — WORDS ARE FORGED HERE NOW. THOUSANDS OF
              GLYPHS CONDENSE INTO A WORD, HOLD, THEN DETONATE INTO THE FLOW
              FIELD AND RE-CAST. STIR THE FIELD WITH YOUR POINTER, CLICK TO
              SHOCKWAVE, OR FORGE YOUR OWN WORD INTO THE GRID.
            </p>
          </div>

          {/* stage */}
          <div
            className="hud-corners relative mt-8 overflow-hidden rounded-md border border-primary/20 bg-[#05080d]"
            data-qa="forge-stage"
          >
            <div
              ref={wrapRef}
              className="relative h-[46svh] min-h-[340px] w-full cursor-crosshair touch-none md:h-[56svh]"
            >
              <canvas ref={canvasRef} className="block" aria-hidden="true" />
              {/* corner HUD — DOM overlays stay crisper than canvas text */}
              <div className="pointer-events-none absolute left-3 top-3 font-mono text-[9px] leading-relaxed tracking-[0.2em] text-primary/50">
                <p>
                  STATE:{" "}
                  <span className={hud.phase === "scatter" ? "text-amber-300" : "text-primary/90"}>
                    {paused ? "PAUSED" : PHASE_LABEL[hud.phase]}
                  </span>
                </p>
                <p>
                  WORD: <span className="text-primary/90">&quot;{hud.word}&quot;</span>
                </p>
                <p className="hidden sm:block">
                  GRID: <span className="tabular-nums">{hud.grid}</span>
                </p>
              </div>
              <div className="pointer-events-none absolute right-3 top-3 text-right font-mono text-[9px] leading-relaxed tracking-[0.2em] text-primary/50">
                <p>
                  PARTICLES: <span className="tabular-nums text-primary/90">{hud.particles}</span>
                </p>
                <p className="hidden sm:block">
                  ENGINE: <span className="text-primary/90">FORGE.RIG</span>
                </p>
                <p>
                  FPS: <span className="tabular-nums">{hud.fps}</span>
                </p>
              </div>
              {/* phase progress */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-secondary/60">
                <div
                  className="h-full bg-gradient-to-r from-primary via-[#93c5fd] to-amber-300"
                  style={{ width: `${paused ? 0 : phasePct}%` }}
                />
              </div>
              <div className="scanlines pointer-events-none absolute inset-0" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.5))]" />
              {/* accessible echo of the current word */}
              <p aria-live="polite" className="sr-only">
                {paused ? "Forge paused" : `${PHASE_LABEL[hud.phase]}: ${hud.word}`}
              </p>
            </div>
          </div>

          {/* control deck */}
          <div className="mt-4 rounded-md border border-border/70 bg-card/50 p-3 backdrop-blur-sm sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="forge-word"
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.25em] text-muted-foreground"
              >
                <Type className="h-3 w-3 text-primary/70" />
                FORGE:
              </label>
              <input
                id="forge-word"
                value={word}
                onChange={(ev) => setWord(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") submitWord();
                }}
                maxLength={14}
                placeholder="TYPE A WORD…"
                aria-label="Word to forge"
                className="h-9 w-40 rounded-sm border border-border bg-[#05080d] px-2.5 font-mono text-xs uppercase tracking-widest text-primary placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:outline-none sm:w-48"
              />
              <button
                onClick={submitWord}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3.5 font-mono text-[10px] font-bold tracking-widest text-primary-foreground transition-all hover:shadow-[0_0_18px_rgba(96,165,250,0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Sparkles className="h-3.5 w-3.5" />
                CAST
              </button>

              <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

              {/* domain chips — forge the club's domains on demand */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/70">
                  DOMAINS:
                </span>
                {DOMAIN_CHIPS.map((d) => (
                  <button
                    key={d}
                    onClick={() => castChip(d)}
                    className="rounded-sm border border-border px-2 py-1 font-mono text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {d}
                  </button>
                ))}
              </div>

              <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

              <button
                onClick={() => detonateRef.current?.()}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-amber-300/40 bg-amber-300/5 px-3 font-mono text-[10px] font-bold tracking-widest text-amber-300 transition-colors hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="blast the field (D)"
              >
                <Bomb className="h-3.5 w-3.5" />
                DETONATE
              </button>
              <button
                onClick={() => setPaused((v) => !v)}
                aria-pressed={paused}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 font-mono text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="pause / resume (P)"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {paused ? "RESUME" : "PAUSE"}
              </button>
              <div className="flex h-9 items-center gap-1">
                <button
                  onClick={dumpTxt}
                  title="dump forge frame → .txt"
                  aria-label="Dump forge frame as text"
                  className="inline-flex h-9 items-center gap-1 rounded-sm border border-border px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Download className="h-3 w-3" />
                  .TXT
                </button>
                <button
                  onClick={dumpPng}
                  title="print forge frame → .png"
                  aria-label="Print forge frame as PNG"
                  className="inline-flex h-9 items-center gap-1 rounded-sm border border-border px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <FileImage className="h-3 w-3" />
                  .PNG
                </button>
              </div>
            </div>
            <p className="mt-3 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60">
              KEYS: <span className="kbd">D</span> DETONATE · <span className="kbd">P</span> PAUSE · CLICK = SHOCKWAVE · POINTER STIRS THE FIELD
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
