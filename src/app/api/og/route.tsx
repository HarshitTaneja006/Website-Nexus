import { ImageResponse } from "next/og";

/**
 * GET /api/og?scene=gate|lab|build|community — dynamic OG card generator.
 * Every flight scene (and the default hero card) gets a phosphor-terminal
 * share image so deep links like /?scene=build unfurl with the right shot,
 * scene number and accent. Rendered with next/og (satori) — no headless
 * browser, cached hard by the CDN.
 *
 * NOTE: satori is flexbox-only (no CSS grid) — all layout below is flex.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

const SCENES: Record<
  string,
  { no: string; label: string; eyebrow: string; title: string; accent: string; tags: string[] }
> = {
  gate: {
    no: "01",
    label: "THE GATE",
    eyebrow: "SCENE 01 · ARRIVAL",
    title: "The Campus Grid",
    accent: "#4ade80",
    tags: ["COMMUNITY", "VIT CHENNAI", "EST. 2019"],
  },
  lab: {
    no: "02",
    label: "THE LAB",
    eyebrow: "SCENE 02 · RESEARCH",
    title: "Where Prototypes Breathe",
    accent: "#a7f3d0",
    tags: ["ROBOTICS", "AI/ML", "IOT"],
  },
  build: {
    no: "03",
    label: "THE BUILD",
    eyebrow: "SCENE 03 · SHIP IT",
    title: "36 Hours. One Shot.",
    accent: "#fbbf24",
    tags: ["HACKATHON", "OPEN SOURCE", "SHIPPING"],
  },
  community: {
    no: "04",
    label: "THE UPLINK",
    eyebrow: "SCENE 04 · TRANSMIT",
    title: "The Rooftop Frequency",
    accent: "#4ade80",
    tags: ["MENTORS", "ALUMNI NET", "YOU"],
  },
};

export async function GET(req: Request) {
  const sceneKey = new URL(req.url).searchParams.get("scene") ?? "";
  const scene = SCENES[sceneKey] ?? null;

  const accent = scene?.accent ?? "#4ade80";
  const title = scene ? scene.title : "Innovate. Lead. Build.";
  const eyebrow = scene ? scene.eyebrow : "NEXUS · STUDENT TECH COLLECTIVE";
  const tags = scene ? scene.tags : ["SCROLL-FLIGHT", "ASCII ENGINE", "VIT CHENNAI"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#050806",
          color: "#e7f5ea",
          padding: 56,
          backgroundImage:
            "linear-gradient(rgba(74,222,128,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.055) 1px, transparent 1px)",
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
                border: "2px solid rgba(74,222,128,0.45)",
                backgroundColor: "rgba(74,222,128,0.10)",
                color: accent,
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              N
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 10, color: "#e7f5ea" }}>
                NEXUS_
              </span>
              <span style={{ fontSize: 15, letterSpacing: 6, color: "rgba(231,245,234,0.5)" }}>
                VIT CHENNAI · EST. 2019
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid rgba(74,222,128,0.30)",
              padding: "10px 18px",
              color: accent,
              fontSize: 16,
              letterSpacing: 5,
            }}
          >
            {scene ? `FLIGHT RECORD ${scene.no}/04` : "FLIGHT RECORD · READY"}
          </div>
        </div>

        {/* title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: 46, height: 2, backgroundColor: accent }} />
            <span style={{ fontSize: 20, letterSpacing: 8, color: accent }}>{eyebrow}</span>
          </div>
          <span
            style={{
              fontSize: title.length > 22 ? 76 : 92,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -1,
              color: "#f2fbf4",
              textShadow: `0 0 32px ${accent}55`,
              display: "flex",
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 22, lineHeight: 1.4, color: "rgba(231,245,234,0.66)", maxWidth: 860, display: "flex" }}>
            {scene
              ? "One continuous scroll-scrubbed shot — your scroll is the camera throttle."
              : "The student tech collective of VIT Chennai. Scroll to fly through our world."}
          </span>
        </div>

        {/* bottom rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  border: "1px solid rgba(74,222,128,0.35)",
                  backgroundColor: "rgba(0,0,0,0.45)",
                  padding: "8px 16px",
                  fontSize: 15,
                  letterSpacing: 4,
                  color: "rgba(231,245,234,0.75)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, letterSpacing: 5, color: "rgba(231,245,234,0.4)" }}>
              12.9066° N, 80.0406° E · NODE: VIT-CHENNAI
            </span>
            <span style={{ fontSize: 15, letterSpacing: 5, color: accent }}>
              {scene ? `NEXUS · /?scene=${sceneKey}` : "INNOVATE ◆ LEAD ◆ BUILD"}
            </span>
          </div>
          {/* scanline strip */}
          <div
            style={{
              width: "100%",
              height: 6,
              display: "flex",
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(74,222,128,0.8) 0 3px, transparent 3px 7px)",
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
