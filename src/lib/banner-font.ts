/**
 * banner-font.ts — figlet-grade block-letter banner engine (v2, from scratch).
 *
 * WHY the old pipeline failed: text was typeset at 480px, downsampled into
 * ~90 binary columns, and each letterart pixel became one painted `#` CELL.
 * A letter therefore had only ~7×5 cells TOTAL, strokes 1 cell wide painted
 * at ~6px pitch merged into solid bands — unreadable mush.
 *
 * THE FIX — letters live in CHARACTER space:
 *   - every letter is a hand-designed 7-row bitmap where each pixel IS one
 *     full `█` character cell (solid ink strokes, guaranteed 1-col counters
 *     between strokes);
 *   - real text, rendered by the browser's mono font → proper hinting,
 *     subpixel AA, selectable — no canvas resampling at all;
 *   - layout is solved, not guessed:
 *       charW(F)  = charW₁₂ · F/12                (font advance scales linearly)
 *       colsAvail = floor(boxW / charW(F))
 *       F*        = 12·boxW / (maxLineCols·charW₁₂)   (exact-fill solve)
 *     scanned F ∈ [13 → 7.5] for the largest size whose wrapped line count
 *     fits; over-long words are hard-split at glyph boundaries so every
 *     title fits its box.
 */

export const BANNER_ROW_H = 7;
const WORD_GAP = 3;

/** Hand-designed 7-row glyphs, '#' = ink, '.' = void. Uniform widths per glyph. */
const SOURCE: Record<string, string[]> = {
  A: [".####.", "#....#", "#....#", "######", "#....#", "#....#", "#....#"],
  B: ["#####.", "#....#", "#....#", "#####.", "#....#", "#....#", "#####."],
  C: [".#####.", "#.....#", "#......", "#......", "#......", "#.....#", ".#####."],
  D: ["#####.", "#....#", "#....#", "#....#", "#....#", "#....#", "#####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".#####.", "#......", "#......", "#..####", "#.....#", "#.....#", ".#####."],
  H: ["#....#", "#....#", "#....#", "######", "#....#", "#....#", "#....#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..####", "...#..", "...#..", "...#..", "...#..", "#..#..", ".##..."],
  K: ["#....#", "#...#.", "#..#..", "###...", "#..#..", "#...#.", "#....#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#.....#", "##...##", "#.#.#.#", "#..#..#", "#.....#", "#.....#", "#.....#"],
  N: ["#.....#", "##....#", "#.#...#", "#..#..#", "#...#.#", "#....##", "#.....#"],
  O: [".#####.", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", ".#####."],
  P: ["#####.", "#....#", "#....#", "#####.", "#.....", "#.....", "#....."],
  Q: [".#####.", "#.....#", "#.....#", "#.....#", "#..#.##", "#...#.#", ".#####."],
  R: ["#####.", "#....#", "#....#", "#####.", "#.#...", "#..#..", "#...#."],
  S: [".####.", "#.....", "#.....", "####..", "....#.", "....#.", "#####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#....#", "#....#", "#....#", "#....#", "#....#", "#....#", ".####."],
  V: ["#.....#", "#.....#", "#.....#", "#.....#", ".#...#.", "..#.#..", "...#..."],
  W: ["#.....#", "#.....#", "#.....#", "#..#..#", "#..#..#", "#.#.#.#", "##...##"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".####.", "#...##", "#..#.#", "#.#..#", "##...#", "#....#", ".####."],
  "1": [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
  "2": [".####.", "#....#", ".....#", "...##.", "..#...", ".#....", "######"],
  "3": ["#####.", ".....#", ".....#", ".#####", ".....#", ".....#", "#####."],
  "4": ["...#..", "..##..", ".#.#..", "#..#..", "######", "...#..", "...#.."],
  "5": ["#####.", "#.....", "#.....", "#####.", ".....#", ".....#", "#####."],
  "6": [".####.", "#.....", "#.....", "#####.", "#....#", "#....#", ".####."],
  "7": ["#####.", ".....#", "....#.", "...#..", "..#...", "..#...", "..#..."],
  "8": [".####.", "#....#", "#....#", ".####.", "#....#", "#....#", ".####."],
  "9": [".####.", "#....#", "#....#", ".#####", ".....#", ".....#", ".####."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
  ".": ["..", "..", "..", "..", "..", "##", "##"],
  ",": ["..", "..", "..", "..", "..", ".#", "#."],
  ":": [".", "#", ".", ".", ".", "#", "."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "'": ["#", "#", ".", ".", ".", ".", "."],
};

/** Compiled to printable ink: '#' → FULL BLOCK, '.' → space. */
const GLYPHS: Record<string, string[]> = Object.fromEntries(
  Object.entries(SOURCE).map(([ch, rows]) => [
    ch,
    rows.map((r) => r.replace(/#/g, "█").replace(/\./g, " ")),
  ])
);

const glyphW = (ch: string): number => GLYPHS[ch]?.[0].length ?? 3;

/** Column budget for one word: Σ glyph widths + 1-col letter gaps. */
export function wordCols(word: string): number {
  let w = 0;
  for (const ch of word) w += glyphW(ch) + 1;
  return Math.max(0, w - 1);
}

/** The 7 rendered rows of one word (letters joined with 1-col gaps). */
function wordRows(word: string): string[] {
  const width = wordCols(word);
  const rows = Array.from({ length: BANNER_ROW_H }, () => "");
  for (const ch of word) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < BANNER_ROW_H; r++) rows[r] += g[r] + " ";
  }
  // CRITICAL: every row must be EXACTLY `width` cols. Rows ending in a
  // void get trimmed by the painter's instinct — but when word rows are
  // later joined with a fixed word gap, a short row shifts everything to
  // its right and shears vertical strokes apart (the "mushed FROM" bug).
  return rows.map((r) => r.replace(/\s+$/, "").padEnd(width, " "));
}

/** Split an over-long word at glyph boundaries so every chunk fits. */
function hardSplit(word: string, colsAvail: number): string[] {
  if (wordCols(word) <= colsAvail) return [word];
  const chunks: string[] = [];
  let rest = word;
  while (wordCols(rest) > colsAvail) {
    let k = rest.length - 1;
    while (k > 1 && wordCols(rest.slice(0, k)) > colsAvail) k--;
    chunks.push(rest.slice(0, k));
    rest = rest.slice(k);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Greedy word-wrap against a column budget; returns glyph-row strings per line. */
function wrapIntoLines(words: string[], colsAvail: number): string[][] | null {
  const lines: string[][] = [];
  let cur: string[] = [];
  let curCols = 0;
  for (const w of words) {
    const wc = wordCols(w);
    if (wc > colsAvail) return null; // caller must hard-split first
    const add = cur.length ? curCols + WORD_GAP + wc : wc;
    if (add <= colsAvail) {
      cur.push(w);
      curCols = add;
    } else {
      lines.push(cur);
      cur = [w];
      curCols = wc;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function lineCols(line: string[]): number {
  return line.reduce((acc, w, i) => (i ? acc + WORD_GAP + wordCols(w) : wordCols(w)), 0);
}

function assembleRows(lines: string[][]): string[] {
  const out: string[] = [];
  lines.forEach((line, li) => {
    const parts = line.map((w) => wordRows(w));
    for (let r = 0; r < BANNER_ROW_H; r++) {
      out.push(parts.map((p) => p[r]).join(" ".repeat(WORD_GAP)).replace(/\s+$/, ""));
    }
    if (li < lines.length - 1) out.push("");
  });
  return out;
}

export interface BannerLayout {
  /** Printable rows ('█' ink / ' ' void) — join with '\n'. */
  rows: string[];
  /** Solved font size in px (exact-fill for the measured box). */
  fontSize: number;
  lines: number;
  cols: number;
}

const F_MAX = 13;
const F_MIN = 7.5;

/**
 * Solve the banner layout for a measured box.
 * @param text    raw title (upper-cased here; unknown chars become word gaps)
 * @param boxW    measured container width in CSS px
 * @param charW12 measured advance width of the mono face at 12px / weight 700
 */
export function layoutBanner(text: string, boxW: number, charW12: number): BannerLayout | null {
  if (!boxW || boxW < 80 || !charW12) return null;
  const words = text
    .toUpperCase()
    .replace(/[^A-Z0-9 .,:!?+/']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;

  // build at a candidate size → exact-fill solve for the widest line
  const fit = (maxLines: number): BannerLayout | null => {
    for (let f = F_MAX; f >= F_MIN; f -= 0.5) {
      const colsAvail = Math.floor(boxW / ((charW12 * f) / 12));
      if (colsAvail < 12) continue;
      const split = words.flatMap((w) => hardSplit(w, colsAvail));
      const lines = wrapIntoLines(split, colsAvail);
      if (!lines || lines.length > maxLines) continue;
      const cols = Math.max(...lines.map(lineCols));
      const fontSize = Math.min(F_MAX, Math.max(6.8, ((12 * boxW) / (cols * charW12)) * 0.985));
      return { rows: assembleRows(lines), fontSize, lines: lines.length, cols };
    }
    return null;
  };

  const two = fit(2);
  const three = fit(3);
  const four = fit(4);
  // prefer the roomier 2-line shape only when it costs little size;
  // 4 lines is the last resort for structurally long titles (e.g.
  // "FOUNDERS FIRECHAT: BUILDING IN INDIA" can never wrap to 3 lines
  // at a legible size — dropping the banner entirely is worse than
  // one extra row band).
  if (two && two.fontSize >= 9.5 && (!three || two.fontSize >= three.fontSize * 0.8)) return two;
  return three ?? four ?? two;
}
