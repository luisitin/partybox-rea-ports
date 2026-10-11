import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
import type { World } from './world';

export function roundPoints(world: World): Record<string, number> {
  return Object.fromEntries(world.runners.map((r) => [r.id, Math.floor(r.distance / 10)]));
}
export function scored(state: State): State {
  const lastPoints = roundPoints(state.world);
  const scores = { ...state.scores };
  for (const [id, metres] of Object.entries(lastPoints)) scores[id] = (scores[id] ?? 0) + metres;
  return { ...state, scores, lastPoints };
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
