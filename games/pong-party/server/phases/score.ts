// The completed arena remains on stage while the final life-and-save scores are read.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scoresOf } from '../scoring';
import { SCORE_MS } from '../types';
import type { State, Transition } from '../types';
import type { Input } from '../world';

export function enterScore(state: State, now: number): State {
  return enterPhase({ ...state, scores: scoresOf(state) }, 'score', now, SCORE_MS);
}

export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
