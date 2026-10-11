// Terminal state includes every initial seat, even a player who left the room.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
import { scoresOf } from '../scoring';

export function enterDone(state: State, now: number): State {
  return enterPhase({ ...state, scores: scoresOf(state.world) }, 'done', now, null);
}
