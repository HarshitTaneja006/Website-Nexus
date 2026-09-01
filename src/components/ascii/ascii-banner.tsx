"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { monoFontStack, monoMetrics } from "@/lib/ascii";
import { layoutBanner } from "@/lib/banner-font";

/**
 * AsciiBanner v2 - typesets a title as a figlet-grade block-letter banner.
 *
 * The banner is REAL TEXT (<pre>) rendered by the browser's mono face -
 * no canvas, no resampling, selectable, pixel-crisp at any DPR. The glyph
 * grid and exact font size are solved mathematically from the measured box
 * (see banner-font.ts); re-solved on resize and once webfonts settle so
 * fallback-face metrics never persist.
 */
export function AsciiBanner({ text, className = "" }: { text: string; className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [fontsSettled, setFontsSettled] = useState(false);

  // measure the box (debounced - resize re-solves the layout)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setBoxW(wrap.clientWidth), 90);
    });
    ro.observe(wrap);
    setBoxW(wrap.clientWidth);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, []);

  // re-solve once the real mono face arrives (metrics change)
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontsSettled(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const layout = useMemo(() => {
    if (!boxW) return null;
    const { charW } = monoMetrics(12, 700);
    return layoutBanner(text, boxW, charW);
  }, [text, boxW, fontsSettled]);

  return (
    <div ref={wrapRef} className={className}>
      {layout && (
        <pre
          role="img"
          aria-label={text}
          className="m-0 max-w-full overflow-x-auto"
          style={{
            fontFamily: monoFontStack(),
            fontWeight: 700,
            fontSize: `${layout.fontSize}px`,
            lineHeight: 1,
            whiteSpace: "pre",
            color: "#60a5fa",
            textShadow: "0 0 12px rgba(96,165,250,0.3)",
          }}
        >
          {layout.rows.join("\n")}
        </pre>
      )}
    </div>
  );
}
