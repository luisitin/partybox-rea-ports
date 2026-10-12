// The chart and verdicts land together. Reading time holds the explanation long enough.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { currentQuestion } from '../content';
import { scoreRound } from '../scoring';
import { modeOf } from '../teams';
import type { Input, State, Transition } from '../types';

const REVEAL_SETTLE_MS = 600;

export function enterReveal(state: State, now: number): State {
  if (state.phase.id === 'reveal') return state;
  const scored = scoreRound(state);
  const { verdicts } = scored;
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
  const mode = modeOf(state);
  // New mode receipts add a team gain or the room's selected answer to the personal receipt.
  const groupWords =
    mode === 'solo'
      ? 0
      : wordCount('Team 4 +1500 team points Place 4') +
        (mode === 'tv-vote' ? wordCount(`Room chose ${q.options[scored.decision ?? 0]}`) : 0);
  const words = Math.max(
    wordCount(tv) + groupWords,
    ...phoneWords.map((count) => count + groupWords),
  );
  const ms = Math.max(4500, REVEAL_SETTLE_MS + readingMs(words, { ui: true }));
  return enterPhase(scored, 'reveal', now, ms);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
