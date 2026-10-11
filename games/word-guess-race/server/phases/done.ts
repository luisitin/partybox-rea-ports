// Ending mid-round credits the same comparisons as its natural reveal, exactly once.
import { enterPhase } from '@partybox/game-sdk';
import { settleRound } from '../scoring';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return state.phase.id === 'done' ? state : enterPhase(settleRound(state), 'done', now, null);
}
