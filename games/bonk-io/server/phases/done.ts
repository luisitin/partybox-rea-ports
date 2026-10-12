import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
import { release } from '../world';

export function enterDone(state: State, now: number): State {
  return state.phase.id === 'done'
    ? state
    : enterPhase({ ...state, world: release(state.world) }, 'done', now, null);
}
