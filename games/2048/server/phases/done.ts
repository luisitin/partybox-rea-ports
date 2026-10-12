// Terminal state preserves every board and merge score, including departed players.
import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';

export function enterDone(state: State, now: number): State {
  return state.phase.id === 'done'
    ? state
    : enterPhase({ ...state, reason: state.reason ?? 'host' }, 'done', now, null);
}
