"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { frameToPngBlob, frameToText, type AsciiFrame } from "@/lib/ascii";

/**
 * AsciiCanvas — real-time animated ASCII scenes on a plain canvas.
 * ASCILINE (https://github.com/YusufB5/ASCILINE) homage: the browser canvas
 * becomes a typographic display surface — every pixel you see is a glyph.
 *
 * Presets:
 *  - rain  : phosphor glyph rain (terminal default)
 *  - donut : the classic spinning torus (donut.c math), live in ASCII
 *  - wave  : interference field — sine waves carved into characters
 *  - cam   : CAMERA FEED → live ASCII (getUserMedia, permission-gated;
 *            graceful phosphor-noise fallback when denied / unsupported)
 */

export type AsciiPreset = "rain" | "donut" | "wave" | "cam";

interface AsciiCanvasProps {
  preset?: AsciiPreset;
  className?: string;
  /** rgb triplet string, e.g. "74,222,128" */
  fg?: string;
  accent?: string;
  /** base font size in px (controls grid density) */
  fontSize?: number;
  speed?: number;
}

const DONUT_CHARS = ".,-~:;=!*#$@";
const GLYPHS = "01<>[]{}#$%&*+=/\\|;:~^".split("");

export function AsciiCanvas({
  preset = "rain",
  className = "",
  fg = "74,222,128",
  accent = "167,243,208",
  fontSize = 11,
  speed = 1,
}: AsciiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: -1, y: -1, down: false, vx: 0, vy: 0 });
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 0;
    let rows = 0;
    let dpr = 1;
    const charW = fontSize * 0.6;
    const lineH = fontSize * 1.04;
    let raf = 0;
    let running = true;
    let visible = true;
    let last = performance.now();
    let t = 0;

    let bright: Float32Array = new Float32Array(0);
    let drops: { x: number; y: number; v: number }[] = [];
    let A = 0.7;
    let B = 0.35;

    // ---- cam preset state ----
    const cleanupTimers: number[] = [];
    let camVideo: HTMLVideoElement | null = null;
    let camStream: MediaStream | null = null;
    let camOff: HTMLCanvasElement | null = null;
    let camOffCtx: CanvasRenderingContext2D | null = null;
    let camState: "off" | "requesting" | "live" | "error" = "off";
    let camMsg = "";
    let camNoiseT = 0;

    // snapshot support — remembers which buffer the last paint used so a
    // FRAME DUMP can serialize the exact grid on screen (zero per-frame cost)
    type LastPaint =
      | { kind: "grid" }
      | { kind: "donut"; zbuf: Float32Array; lbuf: Int8Array }
      | { kind: "noise" }
      | null;
    let lastPaint: LastPaint = null;

    // precomputed trig tables for the donut
    const TH = 90;
    const PH = 210;
    const cosTh = new Float32Array(TH);
    const sinTh = new Float32Array(TH);
    const cosPh = new Float32Array(PH);
    const sinPh = new Float32Array(PH);
    for (let i = 0; i < TH; i++) {
      const th = (i / TH) * Math.PI * 2;
      cosTh[i] = Math.cos(th);
      sinTh[i] = Math.sin(th);
    }
    for (let i = 0; i < PH; i++) {
      const ph = (i / PH) * Math.PI * 2;
      cosPh[i] = Math.cos(ph);
      sinPh[i] = Math.sin(ph);
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(60, rect.width);
      const h = Math.max(60, rect.height);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      cols = Math.ceil(w / charW);
      rows = Math.ceil(h / lineH);
      bright = new Float32Array(cols * rows);
      drops = Array.from({ length: Math.round(cols * 0.5) }, () => ({
        x: Math.floor(Math.random() * cols),
        y: Math.random() * -rows,
        v: 6 + Math.random() * 14,
      }));
    }

    function colorFor(v: number): string {
      const a = Math.max(0.05, Math.min(1, v));
      if (v > 0.86) return `rgba(${accent},${a.toFixed(3)})`;
      return `rgba(${fg},${(a * 0.92).toFixed(3)})`;
    }

    // -------- painting helpers (run-length grouped fillText) --------
    function paintGrid() {
      lastPaint = { kind: "grid" };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * charW, rows * lineH);
      ctx.font = `${fontSize}px var(--font-geist-mono), ui-monospace, monospace`;
      ctx.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        let open = false;
        let runStart = 0;
        let runColor = "";
        const flush = (endX: number) => {
          if (!open) return;
          ctx.fillStyle = runColor;
          let s = "";
          for (let x = runStart; x < endX; x++) {
            const v = bright[y * cols + x];
            s += v > 0.045 ? GLYPHS[Math.min(GLYPHS.length - 1, (v * GLYPHS.length) | 0)] : " ";
          }
          ctx.fillText(s, runStart * charW, y * lineH);
          open = false;
        };
        for (let x = 0; x < cols; x++) {
          const v = bright[y * cols + x];
          if (v <= 0.045) {
            flush(x);
            continue;
          }
          const color = colorFor(v);
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
    }

    function paintDonut(zbuf: Float32Array, lbuf: Int8Array) {
      lastPaint = { kind: "donut", zbuf, lbuf };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * charW, rows * lineH);
      ctx.font = `${fontSize}px var(--font-geist-mono), ui-monospace, monospace`;
      ctx.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        let open = false;
        let runStart = 0;
        let runColor = "";
        const flush = (endX: number) => {
          if (!open) return;
          ctx.fillStyle = runColor;
          let s = "";
          for (let x = runStart; x < endX; x++) {
            const idx = y * cols + x;
            s += zbuf[idx] > 0 ? DONUT_CHARS[Math.max(0, Math.min(11, lbuf[idx]))] : " ";
          }
          ctx.fillText(s, runStart * charW, y * lineH);
          open = false;
        };
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          if (zbuf[idx] <= 0) {
            flush(x);
            continue;
          }
          const color = colorFor(0.28 + (lbuf[idx] / 11) * 0.72);
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
    }

    // -------- presets --------
    function drawRain(dt: number) {
      for (let i = 0; i < bright.length; i++) bright[i] *= Math.pow(0.14, dt);
      for (const d of drops) {
        d.y += d.v * dt * speed;
        const headY = Math.floor(d.y);
        if (headY >= 0 && headY < rows) {
          const idx = headY * cols + d.x;
          bright[idx] = 1.15;
          if (headY - 1 >= 0) bright[idx - cols] = Math.max(bright[idx - cols], 0.62);
          if (headY - 2 >= 0) bright[idx - 2 * cols] = Math.max(bright[idx - 2 * cols], 0.36);
        }
        if (d.y > rows + 4) {
          d.y = Math.random() * -18;
          d.x = Math.floor(Math.random() * cols);
          d.v = 6 + Math.random() * 14;
        }
      }
      paintGrid();
    }

    function drawWave(dt: number) {
      t += dt * speed;
      const px = pointer.current.x;
      const py = pointer.current.y;
      const hasPointer = px >= 0;
      for (let y = 0; y < rows; y++) {
        const ny = y / rows;
        for (let x = 0; x < cols; x++) {
          const nx = x / cols;
          let v =
            Math.sin(nx * 14 + t * 1.6) * Math.cos(ny * 9 - t * 1.1) +
            Math.sin((nx + ny) * 18 - t * 0.9) * 0.55;
          if (hasPointer) {
            const dx = nx - px;
            const dy = ny - py;
            const d2 = dx * dx + dy * dy;
            v += Math.exp(-d2 * 26) * 2.2 * Math.sin(t * 5 - Math.sqrt(d2) * 30);
          }
          const b = (v + 2.2) / 4.4;
          bright[y * cols + x] = Math.max(0.02, Math.min(1, b)) * 0.8;
        }
      }
      paintGrid();
    }

    function drawDonut(dt: number) {
      t += dt;
      A += (0.85 * dt + pointer.current.vx * 2.6) * speed;
      B += (0.5 * dt + pointer.current.vy * 2.6) * speed;
      pointer.current.vx *= 0.9;
      pointer.current.vy *= 0.9;
      const cosA = Math.cos(A);
      const sinA = Math.sin(A);
      const cosB = Math.cos(B);
      const sinB = Math.sin(B);

      const R1 = 1;
      const R2 = 2;
      const K2 = 5;
      const K1 = cols * 0.58;
      const yScale = 0.55;

      const zbuf = new Float32Array(cols * rows);
      const lbuf = new Int8Array(cols * rows);

      for (let j = 0; j < TH; j++) {
        const ct = cosTh[j];
        const st = sinTh[j];
        const circlex = R2 + R1 * ct;
        const circley = R1 * st;
        // rotated normal components (light = (0,1,-1))
        const n1x = ct;
        const n1y = st * cosA;
        const n1z = st * sinA;
        for (let i = 0; i < PH; i++) {
          const cp = cosPh[i];
          const sp = sinPh[i];
          // rotate about z by B, then shade
          const nx = n1x * cosB - n1y * sinB;
          const ny = n1x * sinB + n1y * cosB;
          const L = ny - n1z;

          const x = circlex * (cosB * cp + sinA * sinB * sp) - circley * cosA * sinB;
          const y = circlex * (sinB * cp - sinA * cosB * sp) + circley * cosA * cosB;
          const z = K2 + cosA * circlex * sp + circley * sinA;
          const ooz = 1 / z;
          const xp = (cols / 2 + K1 * ooz * x) | 0;
          const yp = (rows / 2 - K1 * ooz * y * yScale) | 0;
          if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
          const idx = yp * cols + xp;
          if (ooz <= zbuf[idx]) continue;
          zbuf[idx] = ooz;
          const lum = Math.max(0, Math.min(11, Math.round(((L + 0.4) / 1.6) * 11)));
          lbuf[idx] = lum;
        }
      }
      paintDonut(zbuf, lbuf);
    }

    // ---- cam preset: noise screens + live feed sampling ----
    function paintNoiseScreen(lines: string[], sub = "") {
      lastPaint = { kind: "noise" };
      camNoiseT += 0.16;
      for (let i = 0; i < bright.length; i++) {
        bright[i] = Math.random() < 0.08 ? 0.10 + Math.random() * 0.10 : 0;
      }
      paintGrid();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `bold ${Math.round(fontSize * 1.25)}px var(--font-geist-mono), ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(${fg},0.85)`;
      const cx = (cols * charW) / 2;
      const cy = (rows * lineH) / 2;
      const lh = fontSize * 1.7;
      const startY = cy - ((lines.length - 1) * lh) / 2 - (sub ? lh * 0.5 : 0);
      ctx.textAlign = "center";
      lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lh));
      if (sub) {
        ctx.font = `${fontSize}px var(--font-geist-mono), ui-monospace, monospace`;
        ctx.fillStyle = `rgba(${accent},0.75)`;
        ctx.fillText(sub, cx, startY + lines.length * lh);
      }
      ctx.textAlign = "start";
    }

    function drawCamFrame() {
      if (!camVideo || !camOff || !camOffCtx) return;
      if (camVideo.readyState < 2 || camVideo.videoWidth === 0) return;
      // downsample video into the glyph grid (mirrored, selfie-style)
      camOff.width = cols;
      camOff.height = rows;
      camOffCtx.save();
      camOffCtx.scale(-1, 1);
      camOffCtx.drawImage(camVideo, -cols, 0, cols, rows);
      camOffCtx.restore();
      let data: Uint8ClampedArray;
      try {
        data = camOffCtx.getImageData(0, 0, cols, rows).data;
      } catch {
        return;
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const p = (y * cols + x) * 4;
          const lum =
            (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
          // gamma up so dark rooms still render structure
          const v = Math.pow(lum, 0.82);
          bright[y * cols + x] = Math.max(0, Math.min(1.15, v * 1.18));
        }
      }
      paintGrid();
    }

    async function startCam() {
      camState = "requesting";
      if (!navigator.mediaDevices?.getUserMedia) {
        camState = "error";
        camMsg = "NO CAMERA API";
        return;
      }
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.srcObject = camStream;
        await v.play();
        camVideo = v;
        camOff = document.createElement("canvas");
        camOffCtx = camOff.getContext("2d", { willReadFrequently: true });
        camState = "live";
      } catch (err) {
        camState = "error";
        const name = err instanceof DOMException ? err.name : "";
        camMsg =
          name === "NotAllowedError"
            ? "PERMISSION DENIED"
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "NO CAMERA FOUND"
              : "CAMERA OFFLINE";
      }
    }

    function stopCam() {
      camStream?.getTracks().forEach((tr) => tr.stop());
      camStream = null;
      if (camVideo) {
        camVideo.srcObject = null;
        camVideo = null;
      }
      camOff = null;
      camOffCtx = null;
      camState = "off";
    }

    let camAcc = 0;
    function drawCam(dt: number) {
      if (camState === "requesting") {
        paintNoiseScreen(["REQ CAMERA ACCESS…", "ACCEPT THE BROWSER PROMPT"], "live glyph feed once granted");
        return;
      }
      if (camState === "error") {
        paintNoiseScreen(["▚ CAM SIGNAL LOST ▚", camMsg || "CAMERA OFFLINE"], "switch back to RAIN / WAVE / DONUT");
        return;
      }
      if (camState !== "live") {
        paintNoiseScreen(["CAM BOOTING…"]);
        return;
      }
      // throttle the feed to ~15fps for a chunky CRT cadence
      camAcc += dt;
      if (camAcc < 1 / 15) return;
      camAcc = 0;
      drawCamFrame();
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!running || !visible) return;
      if (preset === "rain") drawRain(dt);
      else if (preset === "donut") drawDonut(dt);
      else if (preset === "cam") drawCam(dt);
      else drawWave(dt);
    }

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) {
        if (preset === "donut") drawDonut(0.2);
        else drawWave(0);
      }
    });
    ro.observe(wrap);

    let camStarted = false;
    if (preset === "cam") {
      camStarted = true;
      void startCam();
    }

    if (reduced) {
      if (preset === "donut") drawDonut(0.2);
      else if (preset === "cam") {
        // single static frame once the feed (or the fallback) settles
        const id = window.setTimeout(() => {
          if (camState === "live") drawCamFrame();
          else paintNoiseScreen(["▚ CAM SIGNAL LOST ▚", camMsg || "CAMERA OFFLINE"], "reduced motion: static frame");
        }, 900);
        cleanupTimers.push(id);
      } else drawWave(0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0.02 }
    );
    io.observe(wrap);

    const onVis = () => {
      running = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    const wrap2 = wrap;
    const onMove = (e: PointerEvent) => {
      const rect = wrap2.getBoundingClientRect();
      pointer.current.x = (e.clientX - rect.left) / rect.width;
      pointer.current.y = (e.clientY - rect.top) / rect.height;
      if (pointer.current.down) {
        pointer.current.vy = e.movementY * 0.03;
        pointer.current.vx = e.movementX * 0.03;
      }
    };
    const onDown = () => (pointer.current.down = true);
    const onUp = () => (pointer.current.down = false);
    const onLeave = () => {
      pointer.current.x = -1;
      pointer.current.y = -1;
    };
    wrap2.addEventListener("pointermove", onMove);
    wrap2.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    wrap2.addEventListener("pointerleave", onLeave);

    // ---- FRAME DUMP — serialize the exact glyph grid on screen ----
    // hero.tsx dispatches nexus:hero-dump {format}; the engine answers with a
    // .txt artifact (or a PNG typographic print). Works for every preset —
    // rain/wave sample `bright`, donut re-uses the last z/l buffers, and the
    // offline cam politely refuses.
    const buildFrame = (): AsciiFrame | null => {
      if (!cols || !rows) return null;
      if (preset === "cam" && camState !== "live") return null;
      const lines: string[] = [];
      const colors: (string | null)[][] = [];
      if (preset === "donut" && lastPaint?.kind === "donut") {
        const { zbuf, lbuf } = lastPaint;
        for (let y = 0; y < rows; y++) {
          let line = "";
          for (let x = 0; x < cols; x++) {
            const idx = y * cols + x;
            line += zbuf[idx] > 0 ? DONUT_CHARS[Math.max(0, Math.min(11, lbuf[idx]))] : " ";
          }
          lines.push(line);
          colors.push(new Array(cols).fill(null));
        }
      } else {
        for (let y = 0; y < rows; y++) {
          let line = "";
          for (let x = 0; x < cols; x++) {
            const v = bright[y * cols + x];
            line += v > 0.045 ? GLYPHS[Math.min(GLYPHS.length - 1, (v * GLYPHS.length) | 0)] : " ";
          }
          lines.push(line);
          colors.push(new Array(cols).fill(null));
        }
      }
      return { lines, colors, cols, rows };
    };

    const download = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    };

    const onDump = (e: Event) => {
      const format = (e as CustomEvent<{ format?: "txt" | "png" }>).detail?.format ?? "txt";
      const frame = buildFrame();
      if (!frame || !frame.lines.length) {
        toast({
          title: "NO SIGNAL",
          description:
            preset === "cam"
              ? "the cam feed is offline — nothing to dump yet."
              : "engine still warming up — try again in a second.",
          variant: "destructive",
        });
        return;
      }
      const label = `HERO_${preset.toUpperCase()}`;
      if (format === "png") {
        void frameToPngBlob(frame, { label, mode: preset.toUpperCase() }).then((blob) => {
          if (!blob) {
            toast({ title: "PRINT FAILED", description: "encoder returned nothing", variant: "destructive" });
            return;
          }
          download(blob, `nexus-${label.toLowerCase()}.print.png`);
          toast({ title: "PRINT SPOOLED", description: `${frame.cols}×${frame.rows} glyphs → .png` });
        });
      } else {
        const text = frameToText(frame, { label, mode: preset.toUpperCase() });
        download(new Blob([text], { type: "text/plain;charset=utf-8" }), `nexus-${label.toLowerCase()}.txt`);
        toast({ title: "FRAME DUMPED", description: `${frame.cols}×${frame.rows} glyphs → .txt` });
      }
    };
    window.addEventListener("nexus:hero-dump", onDump);

    return () => {
      cancelAnimationFrame(raf);
      cleanupTimers.forEach((id) => window.clearTimeout(id));
      if (camStarted) stopCam();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wrap2.removeEventListener("pointermove", onMove);
      wrap2.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      wrap2.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("nexus:hero-dump", onDump);
    };
  }, [preset, fg, accent, fontSize, speed, toast]);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
