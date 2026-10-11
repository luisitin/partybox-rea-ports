// Round-end mass is banked once; equal totals share rank through the SDK.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

export function roundPoints(world: World): Record<string, number> {
  return Object.fromEntries(world.snakes.map((s) => [s.id, Math.floor(s.mass)]));
}

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
