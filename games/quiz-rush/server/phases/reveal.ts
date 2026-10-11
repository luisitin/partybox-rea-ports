// The chart and verdicts land together. Reading time holds the explanation long enough.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { currentQuestion } from '../content';
import { judge } from '../scoring';
import type { Input, State, Transition } from '../types';

export function enterReveal(state: State, now: number): State {
  const verdicts = judge(state);
  const scores = { ...state.scores };
  const streaks = { ...state.streaks };
  for (const [id, v] of Object.entries(verdicts)) {
    scores[id] = (scores[id] ?? 0) + v.points;
    streaks[id] = v.streak;
  }
  const q = currentQuestion(state);
  const ms = Math.max(4500, readingMs(wordCount(`${q.options[q.correct]} ${q.explanation}`) + 4));
  return enterPhase({ ...state, scores, streaks, verdicts }, 'reveal', now, ms);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
