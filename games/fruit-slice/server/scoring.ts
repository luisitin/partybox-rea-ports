// Combo doubles the swipe; a safe-wave streak adds a small capped bonus, never a runaway multiplier.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function swipePoints(count: number, streak: number): number {
  return count * 10 * (count >= 3 ? 2 : 1) + Math.min(5, streak) * 2;
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const scores = Object.fromEntries(
    Object.entries(state.seats).map(([id, seat]) => [id, seat.score]),
  );
  return buildResults(state, scores);
}
