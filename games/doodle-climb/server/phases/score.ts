// Scores lock on entry; the reveal can never score again on a stale event.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { credit } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterScore(state: State, now: number): State {
  return enterPhase(credit(state), 'score', now, SCORE_MS);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
