// Phase "question": one locked pick per player within `answerSeconds`. Exits when every connected
// player has picked or the deadline fires; the reveal (`next`) does the scoring.
import { allConnectedDone, enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { isPlayer } from '../types';
import type { Input, State } from '../types';
import type { Advance } from './intro';

/** Asks the next drawn question (index + 1) with fresh picks. */
export function enterQuestion(state: State, now: number): State {
  const index = Math.min(state.index + 1, state.questionIds.length - 1);
  return enterPhase(
    { ...state, index, picks: {} },
    'question',
    now,
    state.settings.answerSeconds * 1000,
  );
}

/**
 * Time into the answer window. Measured from the deadline, not `startedAt`, so a pause (which
 * shifts the deadline) does not eat into the speed bonus. Clamped to [0, window].
 */
export function elapsedMs(state: State, now: number): number {
  const window = state.settings.answerSeconds * 1000;
  const raw =
    state.phase.deadline === null
      ? now - state.phase.startedAt
      : window - (state.phase.deadline - now);
  return Math.min(window, Math.max(0, raw));
}

export function reduceQuestion(state: State, event: GameEvent<Input>, next: Advance): State {
  if (event.type === 'input') {
    if (event.input.type !== 'pick') return state;
    // Playing players only, first pick only: later picks are ignored so "submitted" stays honest.
    if (
      !isPlayer(state, event.playerId) ||
      !state.players[event.playerId]?.connected ||
      Object.hasOwn(state.picks, event.playerId) ||
      event.now < state.phase.startedAt
    )
      return state;
    // A queued tap cannot win a race against the host's deadline timer. Enter the same reveal,
    // without recording it, so the existing "Too slow" verdict is honest even under load.
    if (state.phase.deadline !== null && event.now >= state.phase.deadline)
      return next(state, event.now);
    const picked: State = {
      ...state,
      picks: {
        ...state.picks,
        [event.playerId]: { index: event.input.index, elapsedMs: elapsedMs(state, event.now) },
      },
    };
    return allConnectedDone(picked, Object.keys(picked.picks)) ? next(picked, event.now) : picked;
  }
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
