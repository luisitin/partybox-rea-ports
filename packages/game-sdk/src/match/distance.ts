// Edit distance for the fuzzy level: optimal string alignment (Damerau-Levenshtein where no
// substring is edited twice), so a swapped pair "pengiun" costs one edit, not two (#29).
// Counts code points, not UTF-16 units, so a letter outside the BMP is one letter.

/**
 * OSA distance between `a` and `b`. With `max`, stops as soon as the distance must exceed it and
 * returns some value above `max` (not the exact distance): once every cell of a row is past
 * `max`, every later cell is too (each comes from this row, or from the one before plus a swap,
 * and that row sat at most one edit lower).
 */
export function osaDistance(a: string, b: string, max = Infinity): number {
  const s = Array.from(a);
  const t = Array.from(b);
  if (Math.abs(s.length - t.length) > max) return Math.abs(s.length - t.length);
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let before = new Array<number>(t.length + 1).fill(0);
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  let cur = new Array<number>(t.length + 1).fill(0);
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let d = Math.min(
        (prev[j] as number) + 1,
        (cur[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1])
        d = Math.min(d, (before[j - 2] as number) + 1);
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return rowMin;
    [before, prev, cur] = [prev, cur, before];
  }
  return prev[t.length] as number;
}

/** Length in code points (what the fuzzy allowance and the clue limit count). */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/**
 * The digit runs of a compact form, in order: "apollo13" → "13". Two forms may only fuzz when
 * these are equal (#29, ruling 16): 1984 and 1985 are different answers, not a typo.
 */
export function digitRuns(compact: string): string {
  return (compact.match(/\d+/g) ?? []).join(' ');
}
