// Phase "reveal": scores the question on entry (so views and results agree), shows the answer for
// long enough to read it (revealMs: pacing rule 2026-09-25; was 8 s, the final 5 s), then `next`
// decides what follows (next question, the wager, or done — wired in index.ts).
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scoreCurrentQuestion } from '../scoring';
import { FINAL_REVEAL_MS, REVEAL_MS, isFinalIndex, quizModeOf, groupModeOf } from '../types';
import type { Input, State } from '../types';
import type { Advance } from './intro';
import { classicRevealBeats, groupRevealTiming, wagerRevealBeats } from '../pacing';

/** How long this reveal stays up: its beats, then a slow reader's time for the answer and every
 *  player's row (I-589's 8 s and the final's 5 s are now the floors' neighbours, not the rule). */
export function revealMs(state: State): number {
  if (quizModeOf(state) === 'classic') {
    const beats = classicRevealBeats(state);
    return beats.chartMs + beats.standingsMs;
  }
  const beats = wagerRevealBeats(state);
  return Math.max(
    isFinalIndex(state, state.index) ? FINAL_REVEAL_MS : REVEAL_MS,
    beats.raceMs + beats.standingsMs,
  );
}

export function enterReveal(state: State, now: number): State {
  const scored = scoreCurrentQuestion(state);
  if (groupModeOf(scored)) {
    const beats = groupRevealTiming(scored);
    return enterPhase(
      { ...scored, groupRevealBeats: beats },
      'reveal',
      now,
      beats.chartMs + beats.standingsMs,
    );
  }
  return enterPhase(scored, 'reveal', now, revealMs(scored)); // I-589 note
}

export function reduceReveal(state: State, event: GameEvent<Input>, next: Advance): State {
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  return state;
}
