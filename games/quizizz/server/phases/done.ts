// Terminal state preserves every seat and its earned points.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
export function enterDone(state: State, now: number): State {
  return enterPhase({ ...state, podiumStep: 3, clock: now }, 'done', now, null);
}
