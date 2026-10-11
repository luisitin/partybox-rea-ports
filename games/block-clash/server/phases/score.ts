// Keep the short result sentence on stage long enough for a slow reader.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { Input, State, Transition } from '../types';

export const SCORE_MS = Math.max(
  6000,
  readingMs(wordCount('Survivors first. Block points break ties.')),
);
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
