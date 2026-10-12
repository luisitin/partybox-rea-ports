// Phase "question": one locked pick per player within `answerSeconds`. Exits when every connected
// player has picked or the deadline fires; the reveal (`next`) does the scoring.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { allParticipantsDone, answerWindowOf, isParticipating, quizModeOf } from '../types';
import { classicQuestionMs, questionReadingMs } from '../pacing';
import type { Input, State } from '../types';
import type { Advance } from './intro';

/** Asks the next drawn question (index + 1) with fresh picks. */
export function enterQuestion(state: State, now: number): State {
  const index = Math.min(state.index + 1, state.questionIds.length - 1);
  const asking = { ...state, index, picks: {} };
  const duration = classicQuestionMs(asking);
  return enterPhase(
    {
      ...asking,
      answerWindowMs: duration,
      answerClosesAt: now + duration,
      questionReadableUntil: now + questionReadingMs(asking),
    },
    'question',
    now,
    duration,
  );
}

/**
 * Time into the answer window. Measured from the deadline, not `startedAt`, so a pause (which
 * shifts the deadline) does not eat into the speed bonus. Clamped to [0, window].
 */
export function elapsedMs(state: State, now: number): number {
  const window = answerWindowOf(state);
  const raw =
    (state.answerClosesAt ?? state.phase.deadline) === null
      ? now - state.phase.startedAt
      : window - ((state.answerClosesAt ?? state.phase.deadline ?? now) - now);
  return Math.min(window, Math.max(0, raw));
}

export function reduceQuestion(state: State, event: GameEvent<Input>, next: Advance): State {
  if (event.type === 'input') {
    const classic = quizModeOf(state) === 'classic';
    if (classic) {
      if (
        event.input.type !== 'answer' ||
        event.input.questionId !== state.questionIds[state.index] ||
        event.input.questionStartedAt !== state.phase.startedAt
      )
        return state;
    } else if (event.input.type !== 'pick') return state;
    // Narrow both accepted input variants before reading their shared choice index.
    if (event.input.type !== 'pick' && event.input.type !== 'answer') return state;
    // Playing players only, first pick only: later picks are ignored so "submitted" stays honest.
    if (
      !isParticipating(state, event.playerId) ||
      !state.players[event.playerId]?.connected ||
      Object.hasOwn(state.picks, event.playerId) ||
      event.now < state.phase.startedAt
    )
      return state;
    // A queued tap cannot win a race against the host's deadline timer. Enter the same reveal,
    // without recording it, so the existing "Too slow" verdict is honest even under load.
    const closesAt = state.answerClosesAt ?? state.phase.deadline;
    if (closesAt !== null && event.now >= closesAt) return next(state, event.now);
    const picked: State = {
      ...state,
      picks: {
        ...state.picks,
        [event.playerId]: { index: event.input.index, elapsedMs: elapsedMs(state, event.now) },
      },
    };
    return finishQuestionIfDone(picked, event.now, next);
  }
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  return state;
}

/** Lock answers immediately, then give the question's words their minimum visible hold. */
export function finishQuestionIfDone(state: State, now: number, next: Advance): State {
  if (!allParticipantsDone(state, Object.keys(state.picks))) return state;
  const readableUntil = state.questionReadableUntil ?? state.phase.startedAt;
  if (now >= readableUntil) return next(state, now);
  return state.phase.deadline === readableUntil
    ? state
    : { ...state, phase: { ...state.phase, deadline: readableUntil } };
}
