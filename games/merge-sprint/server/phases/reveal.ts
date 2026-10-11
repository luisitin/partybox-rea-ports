// Freeze the race for a readable eight-second standings beat.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import { REVEAL_MS } from '../types';
import type { Input, State } from '../types';

export function enterReveal(state: State, now: number): State {
  return enterPhase({ ...state, reason: state.reason ?? 'host' }, 'reveal', now, REVEAL_MS);
}
export function reduceReveal(
  state: State,
  event: GameEvent<Input>,
  next: Transition<State>,
): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
