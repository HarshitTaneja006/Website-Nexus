"use client";

import { useEffect, useRef } from "react";
import { paintAscii, textToAsciiFrame } from "@/lib/ascii";

/**
 * AsciiBanner — typesets a short string as an ASCII glyph banner. Client-only
 * (canvas + layout fonts); renders nothing on the server pass.
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = textToAsciiFrame(text, { cols, maxLineChars });
    if (!frame.lines.length) return;
    paintAscii(canvas, frame, {
      fg: "#4ade80",
      bright: "#eaffef",
      bg: null,
      fontSize: 8,
      dpr: Math.min(3, window.devicePixelRatio || 1),
    });
  }, [text, cols, maxLineChars]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`h-auto w-full ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
