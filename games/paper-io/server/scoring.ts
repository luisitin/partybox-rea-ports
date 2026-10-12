import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

export function areaScores(world: World): Record<string, number> {
  return Object.fromEntries(world.runners.map((r) => [r.id, r.area]));
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
