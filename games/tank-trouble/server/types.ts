import type { GameStateBase } from '@partybox/game-sdk';
import { readingMs, wordCount } from '@partybox/game-sdk';
import type { World } from './world';

export const PHASES = ['ready', 'play', 'score', 'done'] as const;
export const ROUNDS = 5;
export const READY_TEXT = 'Find your tank. Steer, fire, and dodge your own rebounds.';
export const READY_MS = readingMs(wordCount(READY_TEXT), { ui: true });
export const SCORE_TEXT = 'Round result. Each win is one point. Next maze starts automatically.';
// Eight names and totals join the result headline; the board gets a slow reader's full floor.
export const SCORE_MS = readingMs(wordCount(SCORE_TEXT) + 16, { ui: true });
export type RoundReason = 'last-standing' | 'draw' | 'time' | 'skip' | null;
export interface State extends GameStateBase {
  began: number;
  endsAt: number;
  checked: number;
  world: World;
  round: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  winnerIds: string[];
  reason: RoundReason;
  settings: { powerups: boolean };
  left: string[];
  phoneOnly?: true;
}
export type Transition = (state: State, now: number) => State;
