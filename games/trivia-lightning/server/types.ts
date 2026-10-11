// JSON state: only the server has the shuffled deck and answer keys.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';
import type { Question } from '../content/schema';

export const PHASES = ['race', 'podium', 'done'] as const;
export const BEAT_MS = 500;
export const FREEZE_MS = 3000;
export const PODIUM_MS = 4500;
export const inputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer'),
    questionId: z.string().max(80),
    index: z.number().int().min(0).max(19),
    choice: z.number().int().min(0).max(3),
  }),
  z.object({ type: z.literal('next'), index: z.number().int().min(1).max(20) }),
  z.object({
    type: z.literal('power'),
    power: z.enum(['freeze', 'double']),
    charge: z.number().int().min(1).max(6),
    target: z.string().max(80).optional(),
  }),
]);
export type Input = z.infer<typeof inputSchema>;
export interface Feedback {
  correct: boolean;
  points: number;
  answer: string;
  explanation: string;
}
export interface Runner {
  answered: number;
  correct: number;
  score: number;
  streak: number;
  energy: number;
  double: boolean;
  freezeUntil: number;
  feedback: Feedback | null;
}
export interface State extends GameStateBase {
  deck: Question[];
  runners: Record<string, Runner>;
  cfg: { pack: string; questions: number; seconds: number; powers: boolean };
  clock: number;
  began: number;
  endsAt: number;
  podiumStep: number;
  phoneOnly: boolean;
  left: string[];
}
export type Transition = (state: State, now: number) => State;
