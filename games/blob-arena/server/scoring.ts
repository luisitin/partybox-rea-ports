// Each round banks the mass still alive at the horn, not peak mass or eliminations.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';
import { totalMass } from './world';

export function roundPoints(world: World, ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, Math.floor(totalMass(world, id))]));
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
