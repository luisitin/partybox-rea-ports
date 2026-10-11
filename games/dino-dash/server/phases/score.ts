import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scored } from '../scoring';
import { SCORE_MS } from '../types';
import type { State, Transition } from '../types';
import type { Input } from '../world';
export function enterScore(state: State, now: number): State {
  return enterPhase(scored(state), 'score', now, SCORE_MS);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
