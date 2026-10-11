import { enterPhase } from '@partybox/game-sdk';
import { distanceScores } from '../scoring';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase({ ...state, scores: distanceScores(state.world) }, 'done', now, null);
}
