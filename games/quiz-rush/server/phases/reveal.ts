// The chart and verdicts land together. Reading time holds the explanation long enough.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { currentQuestion } from '../content';
import { judge } from '../scoring';
import type { Input, State, Transition } from '../types';

const REVEAL_SETTLE_MS = 600;

export function enterReveal(state: State, now: number): State {
  const verdicts = judge(state);
  const scores = { ...state.scores };
  const streaks = { ...state.streaks };
  for (const [id, v] of Object.entries(verdicts)) {
    scores[id] = (scores[id] ?? 0) + v.points;
    streaks[id] = v.streak;
  }
  const q = currentQuestion(state);
  const round = `Question ${state.round} of ${state.deck.length}`;
  const missed = Object.keys(state.players).length - Object.keys(state.answers).length;
  const chart = [
    ...q.options,
    '0 0 0 0 ✓ Correct',
    q.explanation,
    missed > 0 ? `${missed} did not answer` : '',
  ].join(' ');
  const tv = `${round} ${q.prompt} ${chart} ${q.options[q.correct]}`;
  const phoneWords = Object.values(verdicts).map((v) => {
    const summary =
      v.outcome === 'correct'
        ? `Correct! +${v.points} points ${v.base} speed points ` +
          (v.bonus > 0 ? `· +${v.bonus} streak bonus ` : '') +
          `Place 1 · ${v.streak} correct in a row`
        : `${v.outcome === 'timeout' ? 'Too slow' : 'Not this time'} +${v.points} points Place 1`;
    return wordCount(`${round} ${summary} ${chart} ${q.options[q.correct]}`);
  });
  const words = Math.max(wordCount(tv), ...phoneWords);
  const ms = Math.max(4500, REVEAL_SETTLE_MS + readingMs(words, { ui: true }));
  return enterPhase({ ...state, scores, streaks, verdicts }, 'reveal', now, ms);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
