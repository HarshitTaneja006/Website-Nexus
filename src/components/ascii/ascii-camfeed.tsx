"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CircleDot, FileDown, FileImage } from "lucide-react";
import { frameToPngBlob, paintAscii, renderAscii, frameToText, monoMetrics, RAMPS, type AsciiFrame } from "@/lib/ascii";
import { useToast } from "@/hooks/use-toast";

/**
 * AsciiCamFeed — the ASCILINE endgame: a live webcam piped through the same
 * pixel→glyph pipeline as the gallery stills. Everything runs locally in the
 * browser (getUserMedia → canvas sampler → glyphs); no frame ever leaves
 * the machine. Permission-gated, ~12fps, degrade-safe when denied/absent.
 */

type CamState = "idle" | "requesting" | "live" | "denied" | "unavailable" | "stopped";

const TARGET_FPS = 12;

export function AsciiCamFeed() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<AsciiFrame | null>(null);

  const [state, setState] = useState<CamState>("idle");
  const [mode, setMode] = useState<"ascii" | "pixel" | "photo">("ascii");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });
  const [fps, setFps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  const live = state === "live";

  // REC elapsed clock — mm:ss since the stream went live (reset in start())
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  // render loop — glyph-pipeline the camera at ~TARGET_FPS
  useEffect(() => {
    if (state !== "live") return;
    let raf = 0;
    let last = 0;
    const ticks: number[] = [];

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const video = videoRef.current;
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!video || !wrap || !canvas || video.readyState < 2) return;
      if (now - last < 1000 / TARGET_FPS) return;
      last = now;

      // exact-fit grid from measured metrics — canvas renders 1:1 (v2)
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (!width || !height) return;
      const fontSize = width < 420 ? 7 : width < 720 ? 8 : 9;
      const { charW, lineH } = monoMetrics(fontSize);
      const cols = Math.max(32, Math.round(width / charW));
      const rows = Math.max(14, Math.round(height / lineH));

      const f = renderAscii(video, {
        cols,
        rows,
        ramp: mode === "pixel" ? RAMPS.blocks : RAMPS.mid,
        mode: mode === "photo" ? "ascii" : mode,
        gamma: 0.8, // slightly gentler than stills — webcams run dark
        colorize: mode === "pixel",
        supersample: 2, // live feed — lighter sampling, still moiré-free
        sharpen: 0.3,
      });
      frameRef.current = f;
      setGrid({ cols: f.cols, rows: f.rows });

      paintAscii(canvas, f, {
        fg: "#4ade80",
        bright: "#eaffef",
        bg: "#070d08",
        fontSize,
        dpr: Math.min(3, window.devicePixelRatio || 1),
      });

      // rolling fps readout
      ticks.push(now);
      if (ticks.length > 20) ticks.shift();
      if (ticks.length >= 2) {
        const span = (now - ticks[0]) / 1000;
        setFps(Math.round((ticks.length - 1) / Math.max(0.01, span)));
      }
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state, mode]);

  // attach the stream to the persistent hidden <video> when it arrives
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {
      /* autoplay of a muted stream is broadly allowed; ignore */
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const start = useCallback(async () => {
    if (state === "requesting" || state === "live") return;
    setState("requesting");
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setErrorMsg("getUserMedia unsupported in this browser");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      setStream(s);
      setElapsed(0);
      setState("live");
      toast({ title: "CAM ONLINE", description: "glyph pipeline engaged — local only" });
    } catch (err) {
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
        setState("denied");
        setErrorMsg("permission denied — the grid respects your choice");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setState("unavailable");
        setErrorMsg("no camera detected on this device");
      } else {
        setState("unavailable");
        setErrorMsg("camera fault — try again");
      }
    }
  }, [state, toast]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setFps(0);
    setState("stopped");
  }, []);

  // keep streamRef in sync so cleanup paths can always stop the tracks
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // release the camera if the tab hides or the component unmounts
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && streamRef.current) stop();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stop]);

  const snapshot = useCallback(
    (format: "txt" | "png") => {
      const frame = frameRef.current;
      if (!frame || !frame.lines.length) {
        toast({ title: "NO FRAME", description: "enable the cam first", variant: "destructive" });
        return;
      }
      if (format === "png") {
        void frameToPngBlob(frame, { label: "CAM_00.LIVE", mode: mode.toUpperCase() }).then((blob) => {
          if (!blob) {
            toast({ title: "PRINT FAILED", description: "encoder returned nothing", variant: "destructive" });
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `nexus-cam_${new Date().toISOString().replace(/[:.]/g, "-")}.print.png`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "PRINT SPOOLED", description: `${frame.cols}×${frame.rows} glyphs → .png` });
        });
        return;
      }
      const text = frameToText(frame, { label: "CAM_00.LIVE", mode: mode.toUpperCase() });
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-cam_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "FRAME CAPTURED", description: `${frame.cols}×${frame.rows} glyphs → .txt` });
    },
    [mode, toast]
  );

  return (
    <figure className="group relative flex h-full flex-col overflow-hidden rounded-md border border-dashed border-primary/30 bg-card">
      {/* window chrome */}
      <figcaption className="flex items-center justify-between gap-2 border-b border-border/70 bg-secondary/40 px-3 py-2">
        <span className="flex items-center gap-2 truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {live ? (
            <span className="led shrink-0" title="live" />
          ) : (
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-muted-foreground/40" title="offline" />
          )}
          CAM_00.LIVE
        </span>
        <div className="flex items-center gap-1" role="tablist" aria-label="cam feed render mode">
          {(["ascii", "pixel", "photo"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              disabled={!live}
              onClick={() => setMode(m)}
              className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40 ${
                mode === m && live
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground disabled:hover:bg-transparent"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </figcaption>

      {/* render surface */}
      <div
        ref={wrapRef}
        className="relative aspect-[4/3] min-h-0 flex-1 overflow-hidden bg-[#070d08]"
      >
        {/* raw video passthrough for photo mode (kept mounted for the sampler) */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: mode === "photo" && live ? 1 : 0 }}
          muted
          playsInline
          aria-hidden="true"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: live && mode !== "photo" ? 1 : 0,
            imageRendering: "pixelated",
          }}
          aria-hidden="true"
        />

        {!live && (
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              {state === "idle" || state === "stopped" ? (
                <>
                  <div className="font-mono text-[10px] leading-relaxed tracking-wider text-muted-foreground">
                    {state === "idle"
                      ? "OFFLINE — pipe your camera through the glyph engine"
                      : "FEED HALTED — reconnect when ready"}
                  </div>
                  <button
                    onClick={start}
                    className="flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-[10px] tracking-[0.25em] text-primary transition-colors hover:bg-primary/20"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    ENABLE CAM
                  </button>
                </>
              ) : state === "requesting" ? (
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="led led-amber" />
                  awaiting permission…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 font-mono text-[10px] tracking-wider text-destructive/90">
                  <CameraOff className="h-4 w-4" />
                  {errorMsg}
                  <button
                    onClick={start}
                    className="mt-1 rounded-sm border border-border px-3 py-1.5 text-[9px] tracking-[0.25em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    RETRY
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* scanlines + vignette */}
        <div className="scanlines pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
        {live && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-sm bg-[#050a06]/80 px-1.5 py-1 font-mono text-[9px] tracking-[0.2em] text-primary/90 backdrop-blur-sm">
            <CircleDot className="h-2.5 w-2.5 animate-pulse" />
            REC {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* footer readout */}
      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-secondary/30 px-3 py-2">
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {live
            ? `GRID ${grid.cols || "—"}×${grid.rows || "—"} · ${fps} FPS · LOCAL ONLY`
            : "ALL PROCESSING LOCAL — NOTHING IS UPLOADED"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {live && (
            <>
              <button
                onClick={() => snapshot("txt")}
                aria-label="Capture current cam frame as plain-text ASCII"
                title="capture frame → .txt"
                className="rounded-sm border border-transparent p-1 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => snapshot("png")}
                aria-label="Print current cam frame as a PNG typographic print"
                title="print frame → .png"
                className="rounded-sm border border-transparent p-1 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <FileImage className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {live ? (
            <button
              onClick={stop}
              className="rounded-sm border border-destructive/40 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-destructive/90 transition-colors hover:bg-destructive/10"
            >
              STOP
            </button>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
