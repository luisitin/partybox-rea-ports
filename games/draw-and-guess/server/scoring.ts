// Speed helps guessers; a normalized artist reward is fair in small and large rooms.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function guessPoints(elapsed: number, duration: number): number {
  return 100 + Math.round(400 * (1 - Math.min(1, Math.max(0, elapsed / duration))));
}
export function drawerPoints(solved: number, eligible: number): number {
  return eligible > 0 ? Math.round(300 * Math.min(1, solved / eligible)) : 0;
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
