// Freeze the race until the full TV boards or phone standings have had their reading time.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import { revealReadingMs } from '../reveal-reading';
import type { Input, State } from '../types';

export function enterReveal(state: State, now: number): State {
  const frozen = { ...state, reason: state.reason ?? 'host' };
  return enterPhase(frozen, 'reveal', now, revealReadingMs(frozen));
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
