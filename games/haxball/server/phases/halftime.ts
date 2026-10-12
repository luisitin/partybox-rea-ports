import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { HALFTIME_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { resetPitch } from '../world';

export function enterHalftime(state: State, now: number): State {
  return enterPhase(resetPitch({ ...state, clock: now }, now), 'halftime', now, HALFTIME_MS);
}
export function reduceHalftime(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
