// Ready gives everyone the first four notes and the same countdown.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { READY_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterReady(state: State, now: number): State {
  return enterPhase(state, 'ready', now, READY_MS);
}
export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
