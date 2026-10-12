// Phase "intro": a 2 s title beat after the shell's start stage (ADR-053). Exits on the deadline (or VIP skip) into the first question.
// `next` is injected by server/index.ts so phase files never import each other (no cycles).
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { INTRO_MS } from '../types';
import type { Input, State } from '../types';

export type Advance = (state: State, now: number) => State;

export function enterIntro(state: State, now: number): State {
  return enterPhase({ ...state, index: -1 }, 'intro', now, INTRO_MS);
}

export function reduceIntro(state: State, event: GameEvent<Input>, next: Advance): State {
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
