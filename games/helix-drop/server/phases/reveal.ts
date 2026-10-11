// One readable results beat before the shell takes over the final podium.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { REVEAL_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterReveal(state: State, now: number): State {
  return enterPhase(
    { ...state, runners: state.runners.map((r) => ({ ...r, dir: 0, heldUntil: 0 })) },
    'reveal',
    now,
    REVEAL_MS,
  );
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
