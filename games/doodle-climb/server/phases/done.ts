// Terminal match state; an early host end preserves the current climb.
import { enterPhase } from '@partybox/game-sdk';
import { credit } from '../scoring';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase(state.phase.id === 'play' ? credit(state) : state, 'done', now, null);
}
