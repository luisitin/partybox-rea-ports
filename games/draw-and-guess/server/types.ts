// JSON state and bounded inputs. A stroke is a small chunk of one pointer gesture.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';
import type { Word } from '../content/schema';

export const PHASES = ['choose', 'draw', 'reveal', 'done'] as const;
export const CHOOSE_MS = 12_000;
export const REVEAL_MS = 7_000;
export const MAX_POINTS = 2048;
export const MAX_STROKES = 256;
export const MAX_GUESSES = 80;
const point = z.tuple([z.number().int().min(0).max(1000), z.number().int().min(0).max(600)]);
const strokeSchema = z.object({
  id: z.number().int().min(0).max(1_000_000),
  seq: z.number().int().min(0).max(1_000_000),
  color: z.number().int().min(0).max(5),
  size: z.union([z.literal(2), z.literal(5), z.literal(9)]),
  points: z.array(point).min(1).max(32),
});
export type Stroke = z.infer<typeof strokeSchema>;
export const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choose'), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal('stroke'), stroke: strokeSchema }),
  z.object({ type: z.literal('guess'), text: z.string().min(1).max(60) }),
  z.object({ type: z.literal('undo') }),
  z.object({ type: z.literal('clear') }),
]);
export type Input = z.infer<typeof inputSchema>;
export type Feedback = 'none' | 'wrong' | 'close' | 'correct' | 'limited';
export interface State extends GameStateBase {
  settings: { rounds: number; seconds: number; difficulty: string };
  order: string[];
  turnIndex: number;
  drawerId: string;
  choices: Word[];
  word: Word | null;
  used: string[];
  hintIndices: number[];
  hintLevel: number;
  strokes: Stroke[];
  lastSeq: number;
  lastStroke: number;
  eligibleAtStart: number;
  began: number;
  endsAt: number;
  checkedAt: number;
  solved: Record<string, number>;
  guesses: Record<string, string[]>;
  feedback: Record<string, Feedback>;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  left: string[];
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
