// Phase "intro": a 2 s title beat after the shell's start stage (ADR-053). Exits on the deadline (or VIP skip) into the first question.
// `next` is injected by server/index.ts so phase files never import each other (no cycles).
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { INTRO_MS, quizModeOf } from '../types';
import { classicIntroMs, wagerIntroMs } from '../pacing';
import type { Input, State } from '../types';

export type Advance = (state: State, now: number) => State;

export function enterIntro(state: State, now: number): State {
  return enterPhase(
    { ...state, index: -1 },
    'intro',
    now,
    quizModeOf(state) === 'classic'
      ? classicIntroMs(state)
      : Math.max(INTRO_MS, wagerIntroMs(state)),
  );
}

export function reduceIntro(state: State, event: GameEvent<Input>, next: Advance): State {
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  return state;
}
