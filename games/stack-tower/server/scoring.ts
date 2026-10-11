// Height alone decides the race. Equal best heights share a rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
