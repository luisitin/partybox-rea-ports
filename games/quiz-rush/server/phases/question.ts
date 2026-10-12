// Each question accepts one answer per connected seat; unknown, duplicate and stale taps do nothing.
import { enterPhase, hasPlayer, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { currentQuestion } from '../content';
import type { Input, State, Transition } from '../types';

export function enterQuestion(state: State, now: number, round: number): State {
  const fresh = {
    ...state,
    round,
    answers: {},
    verdicts: {},
    previousScores: { ...state.scores },
    openedAt: now,
  };
  const q = currentQuestion(fresh);
  // The longest stage-phone branch: round (4), clock (1), retry status (8), button (2).
  const screenWords = wordCount([q.prompt, ...q.options].join(' ')) + 15;
  const answerMs = Math.max(state.settings.seconds * 1000, readingMs(screenWords, { ui: true }));
  return enterPhase({ ...fresh, answerMs }, 'question', now, answerMs);
}

export function eligibleIds(state: State): string[] {
  return Object.values(state.players)
    .filter((p) => p.connected && !state.left.includes(p.id))
    .map((p) => p.id);
}

export function everyoneAnswered(state: State): boolean {
  return eligibleIds(state).every((id) => Object.hasOwn(state.answers, id));
}

export function reduceQuestion(state: State, event: GameEvent<Input>, next: Transition): State {
  if (isTimerFor(state, event))
    return state.phase.deadline !== null && event.now >= state.phase.deadline
      ? next(state, event.now)
      : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  if (!state.players[event.playerId]!.connected || state.left.includes(event.playerId))
    return state;
  if (
    event.input.type !== 'answer' ||
    event.input.round !== state.round ||
    Object.hasOwn(state.answers, event.playerId)
  )
    return state;
  if (event.now < state.openedAt) return state;
  if (state.phase.deadline !== null && event.now >= state.phase.deadline)
    return next(state, event.now);
  const after = {
    ...state,
    answers: {
      ...state.answers,
      [event.playerId]: { choice: event.input.choice, elapsed: event.now - state.openedAt },
    },
  };
  return everyoneAnswered(after) ? next(after, event.now) : after;
}
