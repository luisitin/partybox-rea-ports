// Final results keep every original player, including dropped and departed seats.
import { enterPhase } from '@partybox/game-sdk';
import { scoresOf } from '../scoring';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase({ ...state, scores: scoresOf(state) }, 'done', now, null);
}
