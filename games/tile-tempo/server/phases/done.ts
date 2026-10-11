// Terminal phase keeps all seats and counts, including disconnected players.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return state.phase.id === 'done' ? state : enterPhase(state, 'done', now, null);
}
