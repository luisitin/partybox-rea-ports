// Phase "reveal": scores the question on entry (so views and results agree), shows the answer for
// long enough to read it (revealMs: pacing rule 2026-09-25; was 8 s, the final 5 s), then `next`
// decides what follows (next question, the wager, or done — wired in index.ts).
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scoreCurrentQuestion } from '../scoring';
import { questionById } from '../content';
import {
  FINAL_BEAT_MS,
  FINAL_REVEAL_MS,
  RACE_SERVER_MS,
  REVEAL_MS,
  isFinalIndex,
  readMs,
  wordCount,
} from '../types';
import type { Input, State } from '../types';
import type { Advance } from './intro';

/** How long this reveal stays up: its beats, then a slow reader's time for the answer and every
 *  player's row (I-589's 8 s and the final's 5 s are now the floors' neighbours, not the rule). */
export function revealMs(state: State): number {
  const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
  const answer = q ? wordCount(q.choices[q.answerIndex] ?? '') : 3;
  const players = Object.keys(state.players).length;
  if (isFinalIndex(state, state.index))
    return Math.max(FINAL_REVEAL_MS, FINAL_BEAT_MS + readMs(answer + 2 + 4 * players));
  // The compact chart adds four letter/count pairs and a missing-answer count (ten words).
  return Math.max(REVEAL_MS, RACE_SERVER_MS + readMs(answer + 12 + 3 * players));
}

export function enterReveal(state: State, now: number): State {
  return enterPhase(scoreCurrentQuestion(state), 'reveal', now, revealMs(state)); // I-589 note
}

export function enterDone(state: State, now: number): State {
  return enterPhase(state, 'done', now, null);
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Advance): State {
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
