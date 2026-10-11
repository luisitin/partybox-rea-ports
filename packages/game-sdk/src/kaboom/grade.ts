// The kaboom kit's grade (T-0646): Jamboree scores a Kaboom Squad minigame for the whole team, S / A / B / C by the team's
// score. Pure helpers; `scaled` bends Jamboree's 8-player thresholds to the seats actually playing.
export type Grade = 'S' | 'A' | 'B' | 'C';
export const GRADES: readonly Grade[] = ['S', 'A', 'B', 'C'];

/** The least team score for S, A and B (below B is C), strictly rising. */
export type Cuts = readonly [s: number, a: number, b: number];

export function gradeOf(team: number, cuts: Cuts): Grade {
  return team >= cuts[0] ? 'S' : team >= cuts[1] ? 'A' : team >= cuts[2] ? 'B' : 'C';
}

/** Jamboree's cuts are for 8 players: with fewer, each cut shrinks in proportion (never below 1, still rising). */
export function scaled(n: number, eight: Cuts): Cuts {
  const k = Math.min(1, Math.max(1, n) / 8);
  const b = Math.max(1, Math.round(eight[2] * k));
  const a = Math.max(b + 1, Math.round(eight[1] * k));
  const s = Math.max(a + 1, Math.round(eight[0] * k));
  return [s, a, b];
}

/** Cuts as shares of the most the team can score (Jamboree's own are about 80 / 50 / 20 percent of the best run). */
export function share(
  max: number,
  shares: readonly [number, number, number] = [0.8, 0.5, 0.2],
): Cuts {
  const b = Math.max(1, Math.round(max * shares[2]));
  const a = Math.max(b + 1, Math.round(max * shares[1]));
  const s = Math.max(a + 1, Math.round(max * shares[0]));
  return [s, a, b];
}
