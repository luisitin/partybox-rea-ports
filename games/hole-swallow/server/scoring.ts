// Points survive respawns; a player's accumulated intake is the final score.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

export function scoresOf(world: World): Record<string, number> {
  return Object.fromEntries(world.holes.map((h) => [h.id, h.score]));
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
