// Pure helpers for the kit's screens: where a note is on the track, what a mark is called, how well the room did.
import type { Note } from '../../rhythm/chart';

/** Where the hit marker sits along the track, in percent from the left. */
export const HIT_X = 16;
export const TRAVEL_MS = 1800;

export const travelOf = (travel: readonly number[] | undefined, kind: number): number =>
  travel?.[kind] ?? travel?.[0] ?? TRAVEL_MS;

/** Percent along the track of a note at song time `t` (ms): it comes in from the right and ends on the marker. */
export function noteX(note: Note, t: number, travel: readonly number[] | undefined): number {
  return HIT_X + ((note.t - t) / travelOf(travel, note.kind)) * (100 - HIT_X);
}

export type Verdict = 'Perfect!' | 'Early' | 'Late' | 'Miss' | 'Dry';
export const VERDICTS: Readonly<Record<string, Verdict>> = {
  p: 'Perfect!',
  e: 'Early',
  l: 'Late',
  x: 'Miss',
  d: 'Dry',
};

/** The newest verdict between two states of one player's marks, or null when nothing was judged in between. */
export function newestVerdict(before: string, after: string): Verdict | null {
  let found: Verdict | null = null;
  for (let i = 0; i < after.length; i++) {
    const a = after[i] ?? '';
    if (before[i] === '.' && a !== '.') found = VERDICTS[a] ?? found;
  }
  return found;
}

export type Rating = 'Superb!' | 'Great!' | 'Good job' | 'Keep practicing';

/** The room's rating from the points won out of the points there were. */
export function ratingOf(points: number, best: number): Rating {
  const share = best <= 0 ? 0 : points / best;
  return share >= 0.85
    ? 'Superb!'
    : share >= 0.65
      ? 'Great!'
      : share >= 0.4
        ? 'Good job'
        : 'Keep practicing';
}

/** The last `n` judged marks of a player, oldest first (for the TV's pips). */
export const lastMarks = (marks: string, n: number): string[] =>
  [...marks].filter((c) => 'pelxd'.includes(c)).slice(-n);
