// A brief leaderboard beat, with time for eight people to read their scores.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { Input, State, Transition } from '../types';

export function enterScore(state: State, now: number): State {
  return enterPhase(state, 'score', now, 7000);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
