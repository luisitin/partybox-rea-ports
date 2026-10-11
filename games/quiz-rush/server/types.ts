// Quiz Rush's serializable match state and input. Answer keys stay on the server.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';
import type { Question } from '../content/schema';

export const PHASES = ['question', 'reveal', 'score', 'podium', 'done'] as const;
export const SCORE_MS = 3500;
export const PODIUM_MS = 2500;
export const inputSchema = z.object({
  type: z.literal('answer'),
  round: z.number().int().min(1).max(20),
  choice: z.number().int().min(0).max(3),
});
export type Input = z.infer<typeof inputSchema>;
export interface Answer {
  choice: number;
  elapsed: number;
}
export interface Verdict {
  outcome: 'correct' | 'wrong' | 'timeout';
  base: number;
  bonus: number;
  points: number;
  streak: number;
}
export interface State extends GameStateBase {
  deck: Question[];
  round: number;
  answers: Record<string, Answer>;
  verdicts: Record<string, Verdict>;
  scores: Record<string, number>;
  streaks: Record<string, number>;
  previousScores: Record<string, number>;
  left: string[];
  openedAt: number;
  answerMs: number;
  podiumStep: number;
  settings: { pack: string; rounds: number; seconds: number };
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
