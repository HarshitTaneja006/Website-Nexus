import { ImageResponse } from "next/og";

/**
 * GET /api/og — the site's social card. A phosphor-terminal share image
 * rendered with next/og (satori) — no headless browser, cached hard by the CDN.
 *
 * NOTE: satori is flexbox-only (no CSS grid) — all layout below is flex.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const accent = "#60a5fa";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#05080d",
          color: "#e7f0fa",
          padding: 56,
          backgroundImage:
            "linear-gradient(rgba(96,165,250,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.055) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        {/* top chrome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 54,
                height: 54,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid rgba(96,165,250,0.45)",
                backgroundColor: "rgba(96,165,250,0.10)",
                color: accent,
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              N
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 10, color: "#e7f0fa" }}>
                NEXUS_
              </span>
              <span style={{ fontSize: 15, letterSpacing: 6, color: "rgba(231,240,250,0.5)" }}>
                VIT CHENNAI · EST. 2019
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid rgba(96,165,250,0.30)",
              padding: "10px 18px",
              color: accent,
              fontSize: 16,
              letterSpacing: 5,
            }}
          >
            GLYPH FOUNDRY · ONLINE
          </div>
        </div>

        {/* title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: 46, height: 2, backgroundColor: accent }} />
            <span style={{ fontSize: 20, letterSpacing: 8, color: accent }}>
              NEXUS · STUDENT TECH COLLECTIVE
            </span>
          </div>
          <span
            style={{
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -1,
              color: "#f2f7ff",
              textShadow: `0 0 32px ${accent}55`,
              display: "flex",
            }}
          >
            Innovate. Lead. Build.
          </span>
          <span style={{ fontSize: 22, lineHeight: 1.4, color: "rgba(231,240,250,0.66)", maxWidth: 860, display: "flex" }}>
            The student tech collective of VIT Chennai — every word on this site is forged from glyphs.
          </span>
        </div>

        {/* bottom rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {["GLYPH FOUNDRY", "ASCII ENGINE", "VIT CHENNAI"].map((t) => (
              <span
                key={t}
                style={{
                  border: "1px solid rgba(96,165,250,0.35)",
                  backgroundColor: "rgba(0,0,0,0.45)",
                  padding: "8px 16px",
                  fontSize: 15,
                  letterSpacing: 4,
                  color: "rgba(231,240,250,0.75)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, letterSpacing: 5, color: "rgba(231,240,250,0.4)" }}>
              12.9066° N, 80.0406° E · NODE: VIT-CHENNAI
            </span>
            <span style={{ fontSize: 15, letterSpacing: 5, color: accent }}>
              INNOVATE ◆ LEAD ◆ BUILD
            </span>
          </div>
          {/* scanline strip */}
          <div
            style={{
              width: "100%",
              height: 6,
              display: "flex",
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(96,165,250,0.8) 0 3px, transparent 3px 7px)",
            }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
