// Terminal scores include everybody who started, including people who left.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
export function enterDone(state: State, now: number): State {
  return enterPhase({ ...state, clock: now }, 'done', now, null);
}
