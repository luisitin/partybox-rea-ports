// Freeze best towers; the reveal reads the same heights that results will rank.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import type { State } from '../types';
import { SCORE_MS } from '../types';
import type { Input } from '../world';

export function enterScore(state: State, now: number): State {
  return enterPhase({ ...state, checked: now }, 'score', now, SCORE_MS);
}

export function reduceScore(state: State, event: GameEvent<Input>, next: Transition<State>): State {
  return isTimerFor(state, event) && event.now >= state.phase.deadline!
    ? next(state, event.now)
    : state;
}
