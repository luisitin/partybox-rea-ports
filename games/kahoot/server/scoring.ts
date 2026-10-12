// Scoring for Lightning Round (README "Scoring"): base + speed + streak per regular question, the
// wager on the final, then awards and results. Pure functions over State; no phase logic here.
import { buildResults, pickAwards, speedPoints } from '@partybox/game-sdk';
import type { GameAward, GameResults } from '@partybox/game-sdk';
import { questionById } from './content';
import {
  BASE_POINTS,
  SPEED_MAX_POINTS,
  STREAK_CAP_POINTS,
  STREAK_STEP_POINTS,
  WAGER_PERCENTS,
  isFinalIndex,
} from './types';
import type { PlayerStats, State, WagerPercent } from './types';

export const EMPTY_STATS: PlayerStats = { correct: 0, correctMs: 0, bestStreak: 0, wagerWon: 0 };

/** Points for a correct regular answer: 500 + speed (500 → 0 over the window) + streak bonus. */
export function questionPoints(elapsedMs: number, answerSeconds: number, streak: number): number {
  const speed = speedPoints(elapsedMs, answerSeconds * 1000, SPEED_MAX_POINTS, 0);
  const streakBonus = Math.min(STREAK_CAP_POINTS, STREAK_STEP_POINTS * Math.max(0, streak - 1));
  return BASE_POINTS + speed + streakBonus;
}

export { clampWager, wagerAmount } from './wager'; // I-752 A
import { wagerAmount } from './wager';

export interface WagerOption {
  percent: WagerPercent;
  amount: number;
}

/** The five wager buttons, minus duplicates: a 0-score player sees only "0". */
export function wagerOptions(score: number): WagerOption[] {
  const seen = new Set<number>();
  const out: WagerOption[] = [];
  for (const percent of WAGER_PERCENTS) {
    const amount = wagerAmount(score, percent);
    if (seen.has(amount)) continue;
    seen.add(amount);
    out.push({ percent, amount });
  }
  return out;
}

/**
 * Applies the outcome of the current question to scores, streaks, stats and lastDelta. Called once
 * when `reveal` starts. Regular question: correct = points, wrong/none = 0 and streak reset. Final:
 * correct = +wager, wrong/none = −wager (the only place a score can go down).
 */
export function scoreCurrentQuestion(state: State): State {
  const question = questionById(state.questionIds[state.index] ?? '', state.contentLang);
  const final = isFinalIndex(state, state.index);
  const scores = { ...state.scores };
  const streaks = { ...state.streaks };
  const stats = { ...state.stats };
  const lastDelta: Record<string, number> = {};
  for (const id of Object.keys(state.players)) {
    const pick = state.picks[id];
    const correct =
      question !== undefined && pick !== undefined && pick.index === question.answerIndex;
    const previous = stats[id] ?? EMPTY_STATS;
    const streak = correct ? (streaks[id] ?? 0) + 1 : 0;
    const wager = state.wagers[id] ?? 0;
    let delta: number;
    // `0 - wager` (not `-wager`) so a lost 0 wager is +0, keeping views JSON-round-trippable.
    if (final) delta = correct ? wager : 0 - wager;
    else
      delta =
        correct && pick ? questionPoints(pick.elapsedMs, state.settings.answerSeconds, streak) : 0;
    scores[id] = (scores[id] ?? 0) + delta;
    streaks[id] = streak;
    lastDelta[id] = delta;
    stats[id] = {
      correct: previous.correct + (correct ? 1 : 0),
      correctMs: previous.correctMs + (correct && pick ? pick.elapsedMs : 0),
      bestStreak: Math.max(previous.bestStreak, streak),
      wagerWon: final && correct ? wager : previous.wagerWon,
    };
  }
  return { ...state, scores, streaks, stats, lastDelta };
}

export function awards(state: State): GameAward[] {
  const stats = (id: string): PlayerStats => state.stats[id] ?? EMPTY_STATS;
  return pickAwards(
    [
      {
        id: 'lightning-fingers',
        title: 'Lightning fingers',
        description: (ms) => `Fastest correct answers: ${(ms / 1000).toFixed(1)} s on average`,
        lowest: true,
        value: (id) => (stats(id).correct >= 1 ? stats(id).correctMs / stats(id).correct : null),
      },
      {
        id: 'hot-streak',
        title: 'Hot streak',
        description: (n) => `${n} correct answers in a row`,
        value: (id) => (stats(id).bestStreak >= 2 ? stats(id).bestStreak : null),
      },
      {
        id: 'high-roller',
        title: 'High roller',
        description: (n) => `Won a ${n}-point wager on the final question`,
        value: (id) => (stats(id).wagerWon >= 1 ? stats(id).wagerWon : null),
      },
    ],
    // Sorted by id, so a tie is deterministic whatever the key order: the first id wins it.
    { candidates: Object.keys(state.players).sort(), ties: { kind: 'one' } },
  );
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const base = buildResults(state, state.scores, awards(state));
  // Everyone scored along the way but the final wager took it all back: say so, rather than the
  // shell's "ended before anyone could" (b2 audit, T-0381).
  const lostAll =
    Object.values(state.scores).every((n) => n <= 0) &&
    Object.values(state.stats).some((st) => st.correct > 0);
  return lostAll ? { ...base, headlineNote: 'The final wager took everyone’s points' } : base;
}
