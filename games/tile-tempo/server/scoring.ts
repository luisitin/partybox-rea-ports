// One correct tile is one point; equal counts share a rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function scoresOf(state: State): Record<string, number> {
  return Object.fromEntries(Object.entries(state.runs).map(([id, run]) => [id, run.tiles]));
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  return buildResults(state, scoresOf(state), [], undefined);
}
