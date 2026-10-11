// Terminal phase preserves towers and every initial player's best height.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase(state, 'done', now, null);
}
