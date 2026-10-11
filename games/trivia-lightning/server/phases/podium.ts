// Third, second, first: each readable beat is scheduled as data.
import { enterPhase, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { PODIUM_MS } from '../types';
import type { Input, State, Transition } from '../types';
export function enterPodium(state: State, now: number): State {
  return enterPhase({ ...state, podiumStep: 1, clock: now }, 'podium', now, PODIUM_MS);
}
export function advancePodium(state: State, now: number, done: Transition): State {
  return state.podiumStep >= 3
    ? done(state, now)
    : nextStep({ ...state, podiumStep: state.podiumStep + 1, clock: now }, now + PODIUM_MS);
}
export function reducePodium(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
