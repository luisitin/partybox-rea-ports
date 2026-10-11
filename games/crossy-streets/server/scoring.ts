import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
import type { World } from './world';

export function distanceScores(world: World): Record<string, number> {
  return Object.fromEntries(world.runners.map((runner) => [runner.id, runner.maxRow]));
}

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
