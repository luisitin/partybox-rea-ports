import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { READY_MS } from '../types';
import type { Input, State, Transition } from '../types';

export const enterReady = (state: State, now: number): State =>
  enterPhase(state, 'ready', now, READY_MS);
export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
