import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
import type { Arena } from './world';

/** Exactly one survivor earns one win. Mutual elimination and multiple cap survivors are draws. */
export function roundPoints(world: Arena): Record<string, number> {
  const alive = world.tanks.filter((tank) => tank.alive);
  return Object.fromEntries(
    world.tanks.map((tank) => [tank.id, alive.length === 1 && tank.alive ? 1 : 0]),
  );
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
