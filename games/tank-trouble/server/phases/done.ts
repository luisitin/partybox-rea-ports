import { buildResults, enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
export function enterDone(state: State, now: number): State {
  const done = enterPhase(state, 'done', now, null);
  return { ...done, winnerIds: buildResults(done, done.scores).winnerIds };
}
