// Third, second, then first. The server reveals each rank tier, including shared ranks.
import { enterPhase, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { standings } from '../scoring';
import { PODIUM_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterPodium(state: State, now: number): State {
  const ranks = standings(state).map((r) => r.rank);
  const first = [3, 2, 1].find((rank) => ranks.includes(rank)) ?? 1;
  return enterPhase({ ...state, podiumStep: 3 - first }, 'podium', now, PODIUM_MS);
}
export function stepPodium(state: State, now: number, done: Transition): State {
  const ranks = standings(state).map((r) => r.rank);
  const next = [3, 2, 1].find((rank) => rank < 3 - state.podiumStep && ranks.includes(rank));
  return next === undefined
    ? done(state, now)
    : nextStep({ ...state, podiumStep: 3 - next }, now + PODIUM_MS);
}
export function reducePodium(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
