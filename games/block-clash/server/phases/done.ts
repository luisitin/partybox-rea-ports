// Terminal state retains every player's board and score, including players who left.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase(state, 'done', now, null);
}
