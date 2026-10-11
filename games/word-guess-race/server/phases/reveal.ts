// The whole word appears only after input closes; standings remain long enough to read aloud.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { settleRound } from '../scoring';
import { REVEAL_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterReveal(state: State, now: number): State {
  return enterPhase(settleRound(state), 'reveal', now, REVEAL_MS);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
