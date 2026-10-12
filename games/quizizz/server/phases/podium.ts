// Occupied third, second, first: each readable beat is scheduled as data.
import { enterPhase, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { PODIUM_MS } from '../types';
import type { Input, State, Transition } from '../types';

function nextOccupiedStep(state: State, current = 0): number {
  const scores = Object.values(state.runners).map((runner) => runner.score);
  return (
    [1, 2, 3].find(
      (step) =>
        step > current &&
        scores.some((score) => 1 + scores.filter((other) => other > score).length === 4 - step),
    ) ?? 3
  );
}

export function enterPodium(state: State, now: number): State {
  return enterPhase(
    { ...state, podiumStep: nextOccupiedStep(state), clock: now },
    'podium',
    now,
    PODIUM_MS,
  );
}
export function advancePodium(state: State, now: number, done: Transition): State {
  return state.podiumStep >= 3
    ? done(state, now)
    : nextStep(
        { ...state, podiumStep: nextOccupiedStep(state, state.podiumStep), clock: now },
        now + PODIUM_MS,
      );
}
export function reducePodium(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
