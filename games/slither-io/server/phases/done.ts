// Terminal state keeps the last arena and banked scores.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase(state, 'done', now, null);
}
