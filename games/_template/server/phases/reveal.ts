// Phase "reveal": the TV shows every answer for a few seconds; scores are locked in on entry.
// Exits on the deadline (or VIP skip) via `next`, which server/index.ts points at "done".
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scoreAnswers } from '../scoring';
import { REVEAL_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterReveal(state: State, now: number): State {
  const scored: State = { ...state, scores: scoreAnswers(state) };
  return enterPhase(scored, 'reveal', now, REVEAL_MS);
}

export function enterDone(state: State, now: number): State {
  return enterPhase(state, 'done', now, null);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
