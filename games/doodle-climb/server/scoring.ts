// Each round awards its highest reached altitude once; ties share ranks.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

export function roundPoints(world: World): Record<string, number> {
  return Object.fromEntries(world.climbers.map((c) => [c.id, Math.floor(Math.max(0, c.peak))]));
}
export function credit(state: State): State {
  const lastPoints = roundPoints(state.world);
  const scores = Object.fromEntries(
    Object.keys(state.players).map((id) => [id, (state.scores[id] ?? 0) + (lastPoints[id] ?? 0)]),
  );
  return { ...state, scores, lastPoints };
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
