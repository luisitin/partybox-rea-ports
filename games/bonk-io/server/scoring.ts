import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

/** A last survivor wins one; a real timeout shares that point among its survivors. All-fall is a draw. */
export function roundPoints(world: World, timeout = false): Record<string, number> {
  const out: Record<string, number> = {};
  const survivors = world.balls.filter((ball) => ball.alive).length;
  for (const ball of world.balls) out[ball.id] = ball.alive && (survivors === 1 || timeout) ? 1 : 0;
  return out;
}

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
