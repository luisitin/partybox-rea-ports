// Freeze the city and give the room enough time to read the complete ranking.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { REVEAL_MS } from '../types';
import type { Input, State } from '../types';
import { scoresOf } from '../scoring';

export function enterReveal(state: State, now: number): State {
  return enterPhase({ ...state, scores: scoresOf(state.world) }, 'reveal', now, REVEAL_MS);
}
export function reduceReveal(
  state: State,
  event: GameEvent<Input>,
  next: (s: State, n: number) => State,
): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
