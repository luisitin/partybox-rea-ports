// Tied ranks: which rows share a chip, and the rank band over a split column's first row.

/**
 * I-146 C: rows on the same rank share one rank badge (T-0181; it was a bracket down the left edge)
 * — a four-way tie stops depending on four identical digits being noticed. `top` / `end` round the
 * badge's ends; null = not in a tie. The board flows column-major (`perCol` rows a column), so a
 * tie that runs past the foot of a column is two pieces (T-0203): one square at the foot (`on`, it
 * stops at the row instead of dangling into the gap), one square at the head of the next column
 * (`top` false) — a sixth tied row alone at the top of column 2 still reads as part of the tie.
 */
export function tieEdges(
  ranks: readonly number[],
  i: number,
  perCol: number,
): { top: boolean; end: boolean; on: boolean } | null {
  const r = ranks[i];
  if (r === undefined) return null;
  const up = ranks[i - 1] === r;
  const down = ranks[i + 1] === r;
  const on = down && (i + 1) % perCol === 0;
  return up || down ? { top: !up, end: !down, on } : null;
}

/** A column that carries on the previous column's tie and then moves on to other ranks: its band
 *  would read "1–8" beside column 1's "1" (hive-rank 489534), so a board like that shows no band
 *  labels. A column that is all one carried-over rank ("4" after "1–4") still reads right. */
export function tieSpansColumns(ranks: readonly number[], perCol: number): boolean {
  for (let i = perCol; i < ranks.length; i += perCol) {
    const last = ranks[Math.min(i + perCol - 1, ranks.length - 1)];
    if (ranks[i] === ranks[i - 1] && last !== ranks[i]) return true;
  }
  return false;
}

/** I-146 B: the rank band over a split column's first row ("1–6", or "4" when the column is one
 *  tie), so a column edge reads as a continuation of the ranking, not a second list. */
export function rankBand(ranks: readonly number[], index: number, perCol: number): string | null {
  if (index % perCol !== 0) return null;
  const first = ranks[index];
  const last = ranks[Math.min(index + perCol - 1, ranks.length - 1)];
  if (first === undefined || last === undefined) return null;
  return first === last ? `${first}` : `${first}–${last}`;
}
