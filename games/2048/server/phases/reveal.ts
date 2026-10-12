// Freeze the race until the TV summaries or phone standings have had their reading time.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import { revealReadingMs } from '../reveal-reading';
import { TERMINAL_PAYOFF_MS } from '../types';
import type { Input, State } from '../types';

export function enterReveal(state: State, now: number): State {
  const reason = state.reason ?? 'host';
  const frozen = {
    ...state,
    reason,
    terminalPayoffUntil:
      reason === 'target' || reason === 'blocked' ? now + TERMINAL_PAYOFF_MS : null,
  };
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
