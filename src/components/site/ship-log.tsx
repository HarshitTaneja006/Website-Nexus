/**
 * ShipLog — a GitHub-style contribution heatmap, rendered as pure ASCII blocks.
 * Activity is seeded deterministically (Math.sin hash), so SSR markup matches
 * the client exactly — no state, no hydration risk, no effect.
 */

const WEEKS = 52;
const GLYPHS = ["·", "░", "▒", "▓", "█"] as const;
const COLORS = [
  "text-primary/15",
  "text-primary/35",
  "text-primary/60",
  "text-primary/85",
  "text-primary text-glow",
] as const;

function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function buildCells(): number[] {
  const out: number[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const r = seeded(w * 7 + d);
      const weekend = d === 0 || d === 6 ? 0.55 : 1;
      const wave = 0.65 + 0.35 * Math.sin(w * 0.7 + 1.2);
      const v = r * wave * weekend;
      out.push(v < 0.18 ? 0 : v < 0.38 ? 1 : v < 0.58 ? 2 : v < 0.78 ? 3 : 4);
    }
  }
  return out;
}

export function ShipLog() {
  const cells = buildCells();
  const total = cells.reduce((a, c) => a + c * 7, 0);

  return (
    <div className="mt-10 rounded-md border border-border/70 bg-card/50 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] tracking-[0.25em] text-muted-foreground">
        <span>
          SHIP_LOG<span className="text-primary/60">.ascii</span> — LAST {WEEKS} WEEKS
        </span>
        <span className="tabular-nums">{total} COMMITS LOGGED</span>
      </div>
      <div
        className="flex gap-[3px] overflow-x-auto pb-1"
        role="img"
        aria-label={`ASCII contribution heatmap of the last ${WEEKS} weeks`}
      >
        {Array.from({ length: WEEKS }).map((_, w) => (
          <div key={w} className="flex shrink-0 flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, d) => {
              const v = cells[w * 7 + d];
              return (
                <span
                  key={d}
                  title={`W${String(w + 1).padStart(2, "0")} · day ${d + 1} · ${v * 7} commits`}
                  className={`cursor-default font-mono text-[10px] leading-[12px] transition-transform hover:scale-125 ${COLORS[v]}`}
                >
                  {GLYPHS[v]}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-1.5 font-mono text-[8px] tracking-widest text-muted-foreground/60">
        LESS
        {GLYPHS.map((g, i) => (
        <span
          key={g}
          className={`${COLORS[i]} text-[10px]`}
        >
            {g}
          </span>
        ))}
        MORE
      </div>
    </div>
  );
}
