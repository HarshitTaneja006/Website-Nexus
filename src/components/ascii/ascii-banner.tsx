"use client";

import { useEffect, useRef, useState } from "react";
import { monoMetrics, paintAscii, textToAsciiFrame } from "@/lib/ascii";

/**
 * AsciiBanner — typesets a short string as an ASCII glyph banner. Client-only
 * (canvas + layout fonts); renders nothing on the server pass.
 *
 * v2 (clarity round):
 *   - painted BOLD (700) at 10px — small regular glyphs antialiase into a
 *     haze on dark backgrounds; heavy ink per cell is what reads as "clear"
 *   - grid is FIT TO THE BOX: cols are clamped so the logical canvas width
 *     matches the container, then CSS size is pinned to the logical size —
 *     the dpr× bitmap lands 1:1 on device pixels (no resample, no blur)
 *   - re-typeset once webfonts settle (fallback-face metrics never persist)
 */
export function AsciiBanner({
  text,
  cols = 110,
  maxLineChars = 16,
  className = "",
}: {
  text: string;
  cols?: number;
  maxLineChars?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsSettled, setFontsSettled] = useState(false);

  // re-typeset when the real mono face arrives — metrics measured against a
  // fallback stack would smear every run
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontsSettled(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas) return;

    const fontSize = 10;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    // fit the glyph grid to the box: clamp cols so the LOGICAL canvas width
    // lands on the container width (1:1 device-pixel mapping, zero resample)
    const { charW } = monoMetrics(fontSize, 700);
    const avail = wrap?.clientWidth ?? 0;
    const fitCols = avail > 48 ? Math.max(40, Math.min(cols, Math.floor(avail / charW))) : cols;

    const frame = textToAsciiFrame(text, { cols: fitCols, maxLineChars });
    if (!frame.lines.length) return;

    const { width, height } = paintAscii(canvas, frame, {
      fg: "#4ade80",
      bright: "#eaffef",
      bg: null,
      fontSize,
      fontWeight: 700,
      dpr,
    });
    if (width && height) {
      // CSS size = logical size → the (dpr×) bitmap maps exactly onto
      // device pixels; crisp at any retina density
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }, [text, cols, maxLineChars, fontsSettled]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="mx-auto block"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
