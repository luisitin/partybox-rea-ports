// A short leaderboard beat after each non-final question.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterScore(state: State, now: number): State {
  return enterPhase(state, 'score', now, SCORE_MS);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
