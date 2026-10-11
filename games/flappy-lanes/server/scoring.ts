// Survival points: strictly earlier crashes count, simultaneous crashes and cap survivors tie.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
import type { World } from './world';

export function roundPoints(world: World): Record<string, number> {
  return Object.fromEntries(
    world.birds.map((a) => [
      a.id,
      world.birds.filter((b) => (b.died ?? Infinity) < (a.died ?? Infinity)).length,
    ]),
  );
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
