// State and input types for Lightning Round. Everything is JSON-serializable (docs/GAME_CONTRACT.md);
// questions are referenced by id so the state stays small and the content pack stays the truth.
import { readingMs, wordCount } from '@partybox/game-sdk';
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['intro', 'question', 'reveal', 'wager', 'done'] as const;
export type PhaseId = (typeof PHASES)[number];

/** Owner's pacing rule (owner decision cc45f4, 2026-09-25, docs/GAME_CONTRACT.md): "Enough time to read" — a
 *  screen of words stays up 1.5 s + 1/3 s a word, x1.3 because a Spanish phone or 200 % text
 *  reads longer (the server cannot see the phones' languages, so the margin is always on). */
export function readMs(words: number): number {
  return readingMs(words, { ui: true });
}
export { wordCount };
/** The title card: a 2 s beat — the name and the topic pill (~5 words). ADR-053: the shell's start
 *  stage has just shown the rules and counted 3 · 2 · 1, so the tagline is gone (was 9 s). */
export const INTRO_MS = 2_000;
/** A regular reveal: the race (2 s), then the standings with the VIP's Next (the owner's note on
 *  I-589). The standings stay up long enough to read every row (~3 words a player) and the answer
 *  plus the ten-word answer chart — at least REVEAL_MS (was a flat 8 s: short at 8+ players;
 *  pacing rule 2026-09-25). */
export const REVEAL_MS = 8_000;
export const RACE_SERVER_MS = 2_000;
/** The final reveal: its verdict beats (1.2 s), then every player's bet, verdict and delta (~4
 *  words each) and the answer, at least FINAL_REVEAL_MS — no standings page, the results follow
 *  (was a flat 5 s). */
export const FINAL_REVEAL_MS = 8_000;
export const FINAL_BEAT_MS = 1_200;
export const WAGER_MS = 15_000;

/** Scoring constants (README "Scoring"). */
export const BASE_POINTS = 500;
export const SPEED_MAX_POINTS = 500;
export const STREAK_STEP_POINTS = 100;
export const STREAK_CAP_POINTS = 300;
export const WAGER_PERCENTS = [0, 25, 50, 75, 100] as const;
export type WagerPercent = (typeof WAGER_PERCENTS)[number];

export interface Settings {
  questions: number;
  answerSeconds: number;
  category: string;
  /** Ticked topics of `category` (empty = the whole category). */
  subcategories: string[];
}

export interface Pick {
  /** Chosen choice index 0–3. */
  index: number;
  /** How far into the answer window the pick arrived (pause-corrected, clamped to the window). */
  elapsedMs: number;
}

export interface PlayerStats {
  /** Correct answers over the whole game (regular + final). */
  correct: number;
  /** Sum of `elapsedMs` over correct answers; `correctMs / correct` is the "Lightning fingers" metric. */
  correctMs: number;
  bestStreak: number;
  /** Wager won on the final question (0 when lost or not wagered). */
  wagerWon: number;
}

export interface State extends GameStateBase {
  /** Standalone room-stage flag, captured from ctx.presence; absent in legacy fixtures. */
  phoneOnly?: boolean;
  settings: Settings;
  /** Category the questions were actually drawn from: the setting, or `all` after a fallback. */
  drawnFrom: string;
  /** Topics actually drawn from (empty = the whole category; absent in older states). */
  drawnSubs?: string[];
  /** ADR-054: the deck's language, fixed at init. Absent (older states, fixtures) = English. */
  contentLang?: 'en' | 'es';
  /** Drawn question ids: `settings.questions` regular ones followed by the final question. */
  questionIds: string[];
  /** Index into `questionIds` of the question being asked or just revealed; -1 during `intro`. */
  index: number;
  /** Picks for the current question; cleared when the next question starts. */
  picks: Record<string, Pick>;
  scores: Record<string, number>;
  /** Consecutive correct answers including the last one revealed. */
  streaks: Record<string, number>;
  /** Final-question wager amounts (points). Missing = 0. */
  wagers: Record<string, number>;
  /** Score change per player at the last reveal (negative on a lost wager). */
  lastDelta: Record<string, number>;
  stats: Record<string, PlayerStats>;
}

export const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pick'), index: z.number().int().min(0).max(3) }),
  // A preset share, or (I-026, the owner) a custom stake in points — the server clamps it
  // (0…score, rounded down to tens); `amount` wins when both are sent.
  z.object({
    type: z.literal('wager'),
    percent: z
      .union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)])
      .optional(),
    amount: z.number().int().min(0).max(1_000_000).optional(),
  }),
]);
export type Input = z.infer<typeof inputSchema>;

/** True when `id` is a playing player (own property — `__proto__` and friends are not players). */
export function isPlayer(state: GameStateBase, id: string): boolean {
  return Object.hasOwn(state.players, id);
}

/** The final question is the last drawn id. */
export function isFinalIndex(state: State, index: number): boolean {
  return index === state.questionIds.length - 1;
}
