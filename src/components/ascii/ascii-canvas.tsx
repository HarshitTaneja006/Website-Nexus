"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { frameToPngBlob, frameToText, monoFontStack, monoMetrics, RAMPS, type AsciiFrame } from "@/lib/ascii";

/**
 * AsciiCanvas — real-time animated ASCII scenes on a plain canvas.
 * ASCILINE (https://github.com/YusufB5/ASCILINE) homage: the browser canvas
 * becomes a typographic display surface — every pixel you see is a glyph.
 *
 * v2: fonts resolve to the real Geist Mono family (canvas ctx.font cannot
 * read CSS var() — v1 silently rendered 10px sans-serif), cell metrics are
 * MEASURED per resize, and the donut runs the canonical donut.c math:
 * rigid rotate-X(A)→rotate-Z(B) applied to BOTH point and normal, so the
 * torus no longer wobbles/deforms and the shading tracks the surface.
 *
 * Presets:
 *  - rain  : phosphor glyph rain (terminal default)
 *  - donut : the classic spinning torus (donut.c math), live in ASCII
 *  - wave  : interference field — sine waves carved into characters
 *  - cam   : LIVE FEED → ASCII. Dual-source signal chain:
 *            ① real webcam (getUserMedia, permission-gated, mirrored)
 *            ② on ANY failure (denied / no API / insecure context / no
 *               device) it auto-falls back to the SYNTH feed — the
 *               blob-loaded hero-flight fly-through looped through the
 *               same glyph sampler, so the backdrop ALWAYS moves
 *            ③ phosphor-noise screen only if both sources die
 *            Every source change broadcasts `nexus:hero-feed` so the hero
 *            HUD can show exactly what is on air.
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

const GLYPHS = "01<>[]{}#$%&*+=/\\|;:~^".split("");
const DONUT_CHARS = RAMPS.donut.split("");

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
    // measured metrics — recomputed on resize (never assume 0.6em)
    let charW = monoMetrics(fontSize).charW;
    let lineH = monoMetrics(fontSize).lineH;
    // cell aspect (width/height) — compensates tall terminal cells so the
    // donut renders geometrically round (re-measured on resize, fonts may
    // land after mount)
    let yScale = charW / lineH;
    let raf = 0;
    let running = true;
    let visible = true;
    let last = performance.now();
    let t = 0;

    let bright: Float32Array = new Float32Array(0);
    let drops: { x: number; y: number; v: number }[] = [];
    let A = 0.7;
    let B = 0.35;

    // ---- cam preset state (dual-source signal chain) ----
    const cleanupTimers: number[] = [];
    let camVideo: HTMLVideoElement | null = null; // source ① real webcam
    let camStream: MediaStream | null = null;
    let synthVideo: HTMLVideoElement | null = null; // source ② fly-through loop
    let synthUrl: string | null = null;
    let activeSource: "cam" | "synth" | null = null;
    let camOff: HTMLCanvasElement | null = null;
    let camOffCtx: CanvasRenderingContext2D | null = null;
    let camState: "off" | "requesting" | "live" | "error" = "off";
    let camMsg = "";
    let camNoiseT = 0;

    const announce = (state: string, source: string | null, message?: string) => {
      window.dispatchEvent(
        new CustomEvent("nexus:hero-feed", { detail: { state, source, message } })
      );
    };

    // snapshot support — remembers which buffer the last paint used so a
    // FRAME DUMP can serialize the exact grid on screen (zero per-frame cost)
    type LastPaint =
      | { kind: "grid" }
      | { kind: "donut"; zbuf: Float32Array; lbuf: Int8Array }
      | { kind: "noise" }
      | null;
    let lastPaint: LastPaint = null;

    // precomputed trig tables for the donut (θ = tube cross-section,
    // φ = revolve around the axis)
    const TH = 96;
    const PH = 256;
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
      const m = monoMetrics(fontSize);
      charW = m.charW;
      lineH = m.lineH;
      yScale = charW / lineH;
      cols = Math.ceil(w / charW);
      rows = Math.ceil(h / lineH);
      bright = new Float32Array(cols * rows);
      drops = Array.from({ length: Math.round(cols * 0.5) }, () => ({
        x: Math.floor(Math.random() * cols),
        y: Math.random() * -rows,
        v: 6 + Math.random() * 14,
      }));
    }

    function setFont(px: number, weight = "") {
      ctx!.font = `${weight ? weight + " " : ""}${px}px ${monoFontStack()}`;
    }

    function colorFor(v: number): string {
      const a = Math.max(0.05, Math.min(1, v));
      if (v > 0.86) return `rgba(${accent},${a.toFixed(3)})`;
      return `rgba(${fg},${(a * 0.92).toFixed(3)})`;
    }

    // -------- painting helpers (run-length grouped fillText) --------
    function paintGrid() {
      lastPaint = { kind: "grid" };
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, cols * charW, rows * lineH);
      setFont(fontSize);
      ctx!.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        let open = false;
        let runStart = 0;
        let runColor = "";
        const flush = (endX: number) => {
          if (!open) return;
          ctx!.fillStyle = runColor;
          let s = "";
          for (let x = runStart; x < endX; x++) {
            const v = bright[y * cols + x];
            s += v > 0.045 ? GLYPHS[Math.min(GLYPHS.length - 1, (v * GLYPHS.length) | 0)] : " ";
          }
          ctx!.fillText(s, runStart * charW, y * lineH);
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
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, cols * charW, rows * lineH);
      setFont(fontSize);
      ctx!.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        let open = false;
        let runStart = 0;
        let runColor = "";
        const flush = (endX: number) => {
          if (!open) return;
          ctx!.fillStyle = runColor;
          let s = "";
          for (let x = runStart; x < endX; x++) {
            const idx = y * cols + x;
            s += zbuf[idx] > 0 ? DONUT_CHARS[Math.max(0, Math.min(11, lbuf[idx]))] : " ";
          }
          ctx!.fillText(s, runStart * charW, y * lineH);
          open = false;
        };
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          if (zbuf[idx] <= 0) {
            flush(x);
            continue;
          }
          const color = colorFor(0.24 + (lbuf[idx] / 11) * 0.76);
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

    /**
     * The canonical donut.c projection, in cell space:
     *   point  P(θ,φ) = ((R2+R1·cosθ)·cosφ, (R2+R1·cosθ)·sinφ, R1·sinθ)
     *   normal N(θ,φ) = (cosθ·cosφ, cosθ·sinφ, sinθ)
     * then rotate about X by A, about Z by B — the SAME rigid transform for
     * point and normal (v1 mixed cosA/sinA between them → wobbly deformed
     * torus). Light L = (0,1,−1)/√2 · N. yScale (measured cell aspect)
     * keeps the silhouette round on tall terminal cells, and K1 fits BOTH
     * axes so the torus never clips.
     */
    function drawDonut(dt: number) {
      t += dt;
      A += (0.85 * dt + pointer.current.vx * 2.6) * speed;
      B += (0.5 * dt + pointer.current.vy * 2.6) * speed;
      pointer.current.vx *= 0.9;
      pointer.current.vy *= 0.9;

      const R1 = 1; // tube radius
      const R2 = 2; // torus radius
      const K2 = 5; // camera distance
      // fit: silhouette ≈ K1·(R1+R2)/K2 = 0.6·K1 cells → keep ≤46% of both axes
      const K1 = 0.75 * Math.min(cols, rows / yScale);

      const cosA = Math.cos(A);
      const sinA = Math.sin(A);
      const cosB = Math.cos(B);
      const sinB = Math.sin(B);

      const zbuf = new Float32Array(cols * rows);
      const lbuf = new Int8Array(cols * rows);
      const invSqrt2 = Math.SQRT1_2;

      for (let j = 0; j < TH; j++) {
        const ct = cosTh[j];
        const st = sinTh[j];
        // radial distance from torus center + offset along the axis
        const cx = R2 + R1 * ct;
        const cy = R1 * st;
        // surface normal before rotation: (ct·cosφ, ct·sinφ, st)
        const nx0 = ct;
        const ny0 = ct;
        const nz0 = st;
        for (let i = 0; i < PH; i++) {
          const cp = cosPh[i];
          const sp = sinPh[i];

          // point — rotate about X by A, then about Z by B
          const px = cx * cp;
          const py = cx * sp;
          const pz = cy;
          const py1 = py * cosA - pz * sinA;
          const pz1 = py * sinA + pz * cosA;
          const x2 = px * cosB - py1 * sinB;
          const y2 = px * sinB + py1 * cosB;
          const z2 = pz1;

          // normal — the same two rotations
          const ny1 = ny0 * sp * cosA - nz0 * sinA;
          const nz1 = ny0 * sp * sinA + nz0 * cosA;
          const ny2 = nx0 * cp * sinB + ny1 * cosB;

          // light (0, 1, -1)/√2 — top-front lit, classic donut.c shading
          const L = (ny2 - nz1) * invSqrt2;

          const ooz = 1 / (K2 + z2);
          const xp = (cols / 2 + K1 * ooz * x2) | 0;
          const yp = (rows / 2 - K1 * ooz * y2 * yScale) | 0;
          if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
          const idx = yp * cols + xp;
          if (ooz <= zbuf[idx]) continue;
          zbuf[idx] = ooz;
          // tonal curve biases toward mid-dark — back edges stay readable
          const b = L * 0.5 + 0.5;
          lbuf[idx] = Math.max(0, Math.min(11, Math.round(Math.pow(b, 1.35) * 11)));
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
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      setFont(Math.round(fontSize * 1.25), "bold");
      ctx!.textBaseline = "middle";
      ctx!.fillStyle = `rgba(${fg},0.85)`;
      const cx = (cols * charW) / 2;
      const cy = (rows * lineH) / 2;
      const lh = fontSize * 1.7;
      const startY = cy - ((lines.length - 1) * lh) / 2 - (sub ? lh * 0.5 : 0);
      ctx!.textAlign = "center";
      lines.forEach((l, i) => ctx!.fillText(l, cx, startY + i * lh));
      if (sub) {
        setFont(fontSize);
        ctx!.fillStyle = `rgba(${accent},0.75)`;
        ctx!.fillText(sub, cx, startY + lines.length * lh);
      }
      ctx!.textAlign = "start";
    }

    function drawCamFrame() {
      const v = activeSource === "cam" ? camVideo : synthVideo;
      if (!v || !camOff || !camOffCtx) return;
      if (v.readyState < 2 || v.videoWidth === 0) return;
      // downsample the active source into the glyph grid — center-crop
      // (object-cover math) so nothing stretches; webcam is mirrored
      camOff.width = cols;
      camOff.height = rows;
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const target = cols / rows;
      const src = vw / vh;
      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      if (src > target) {
        sw = vh * target;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / target;
        sy = (vh - sh) / 2;
      }
      if (activeSource === "cam") {
        camOffCtx.save();
        camOffCtx.scale(-1, 1);
        camOffCtx.drawImage(v, sx, sy, sw, sh, -cols, 0, cols, rows);
        camOffCtx.restore();
      } else {
        camOffCtx.drawImage(v, sx, sy, sw, sh, 0, 0, cols, rows);
      }
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

    /* --------------------------------------------------------------
     * Cross-browser camera plumbing.
     * "Works on some browsers, not others" — the usual culprits, each
     * handled explicitly below:
     *   1. insecure context (http / sandboxed preview iframe without
     *      allow="camera") → getUserMedia missing or SecurityError;
     *   2. permission hard-denied in browser settings (Chrome resolves
     *      instantly, Safari just hangs) → Permissions pre-check;
     *   3. camera held by another app (NotReadableError — Zoom/Meet);
     *   4. Safari/iOS play() quirks: detached <video> may reject with
     *      AbortError or simply never start → race loadeddata, then
     *      attach to the DOM as a last resort;
     *   5. strict constraints on laptops without exact camera modes
     *      → a fallback constraint chain (ideal → any → facingMode).
     * Every failure path funnels into the SYNTH feed — the backdrop
     * always shows a live glyph stream, whatever the browser decided.
     * ------------------------------------------------------------ */
    function waitVideoReady(v: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
      return new Promise((resolve) => {
        if (v.readyState >= 2) {
          resolve(true);
          return;
        }
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          v.removeEventListener("loadeddata", onData);
          window.clearTimeout(tid);
          resolve(ok);
        };
        const onData = () => done(true);
        v.addEventListener("loadeddata", onData);
        const tid = window.setTimeout(() => done(v.readyState >= 2), timeoutMs);
      });
    }

    async function playVideo(v: HTMLVideoElement): Promise<boolean> {
      try {
        await v.play();
      } catch {
        /* AbortError / NotAllowedError — the readiness poll decides */
      }
      if (await waitVideoReady(v, 2500)) return true;
      // Safari last resort: detached videos sometimes refuse to start —
      // mount one off-screen and try once more
      if (!v.isConnected) {
        v.style.cssText =
          "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;";
        document.body.appendChild(v);
        try {
          await v.play();
        } catch {
          /* ignored — the readiness poll decides */
        }
        if (await waitVideoReady(v, 2500)) return true;
      }
      return false;
    }

    async function startCam() {
      camState = "requesting";
      announce("requesting", null, "REQUESTING CAMERA");
      if (window.isSecureContext === false) {
        void startSynth("INSECURE CONTEXT — SYNTH ENGAGED");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        void startSynth("NO CAMERA API — SYNTH ENGAGED");
        return;
      }
      // Chrome answers permissions.query instantly; Safari/Firefox throw
      // on the name — either way the fallback chain below still runs
      try {
        const perm = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
        if (perm?.state === "denied") {
          void startSynth("CAMERA BLOCKED IN BROWSER SETTINGS — SYNTH ENGAGED");
          return;
        }
      } catch {
        /* unsupported permission name — keep going */
      }

      // fallback chain: preferred shape → any camera → user-facing only
      const chain: MediaStreamConstraints[] = [
        { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false },
        { video: true, audio: false },
        { video: { facingMode: "user" }, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const c of chain) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
          // hard permission denial won't heal by re-asking — stop hammering
          if (e instanceof DOMException && e.name === "NotAllowedError") break;
        }
      }
      if (!stream) {
        const name = lastErr instanceof DOMException ? lastErr.name : "";
        const reason =
          name === "NotAllowedError"
            ? "PERMISSION DENIED — SYNTH ENGAGED"
            : name === "SecurityError"
              ? "BLOCKED BY BROWSER POLICY — SYNTH ENGAGED"
              : name === "NotFoundError"
                ? "NO CAMERA FOUND — SYNTH ENGAGED"
                : name === "NotReadableError"
                  ? "CAMERA BUSY (OTHER APP?) — SYNTH ENGAGED"
                  : name === "OverconstrainedError"
                    ? "NO MATCHING CAMERA — SYNTH ENGAGED"
                    : "CAMERA OFFLINE — SYNTH ENGAGED";
        void startSynth(reason);
        return;
      }

      camStream = stream;
      const v = document.createElement("video");
      v.muted = true;
      v.setAttribute("muted", ""); // attribute form — iOS Safari honor
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.autoplay = true;
      v.srcObject = stream;
      const ok = await playVideo(v);
      if (!ok) {
        v.srcObject = null;
        v.remove();
        camStream.getTracks().forEach((tr) => tr.stop());
        camStream = null;
        void startSynth("CAMERA FEED TIMEOUT — SYNTH ENGAGED");
        return;
      }
      camVideo = v;
      camOff = document.createElement("canvas");
      camOffCtx = camOff.getContext("2d", { willReadFrequently: true });
      activeSource = "cam";
      camState = "live";
      announce("live", "cam", "CAMERA GRANTED");
    }

    /**
     * Synth feed — the hero-flight fly-through, blob-loaded and looped,
     * pushed through the exact same glyph sampler as the webcam. This is
     * why the cam backdrop now works EVERYWHERE: permission-less preview
     * iframes, insecure contexts, machines without cameras.
     */
    async function startSynth(reason: string) {
      try {
        const res = await fetch("/media/hero-flight.mp4");
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        synthUrl = URL.createObjectURL(blob);
        const v = document.createElement("video");
        v.muted = true;
        v.setAttribute("muted", "");
        v.loop = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.autoplay = true;
        v.src = synthUrl;
        const ok = await playVideo(v);
        if (!ok) throw new Error("synth feed timeout");
        synthVideo = v;
        if (!camOff) {
          camOff = document.createElement("canvas");
          camOffCtx = camOff.getContext("2d", { willReadFrequently: true });
        }
        activeSource = "synth";
        camState = "live";
        announce("live", "synth", reason);
      } catch {
        camState = "error";
        camMsg = "FEED OFFLINE";
        announce("error", null, camMsg);
      }
    }

    function stopCam() {
      camStream?.getTracks().forEach((tr) => tr.stop());
      camStream = null;
      if (camVideo) {
        camVideo.srcObject = null;
        camVideo.remove(); // playVideo() may have mounted it for Safari
        camVideo = null;
      }
      if (synthVideo) {
        synthVideo.pause();
        synthVideo.src = "";
        synthVideo.remove();
        synthVideo = null;
      }
      if (synthUrl) {
        URL.revokeObjectURL(synthUrl);
        synthUrl = null;
      }
      activeSource = null;
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
        // only reachable when BOTH the webcam and the synth feed failed
        paintNoiseScreen(["▚ FEED SIGNAL LOST ▚", camMsg || "ALL SOURCES OFFLINE"], "switch back to RAIN / WAVE / DONUT");
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
          else paintNoiseScreen(["▚ FEED SIGNAL LOST ▚", camMsg || "ALL SOURCES OFFLINE"], "reduced motion: static frame");
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
              ? "the feed is still spooling — try again in a second."
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
