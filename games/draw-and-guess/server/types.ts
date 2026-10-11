// JSON state, bounded drawing messages and public view types.
import { z } from '@partybox/game-sdk';
import type { GameStateBase, TvView, ControllerView } from '@partybox/game-sdk';

export const PHASES = ['choose', 'draw', 'reveal', 'done'] as const;
export const MAX_STROKES = 240;
export const BEAT_MS = 2000;
export const CHOOSE_MS = 8000;
export const pointSchema = z.tuple([
  z.number().finite().min(0).max(1000),
  z.number().finite().min(0).max(600),
]);
export const strokeSchema = z.object({
  gesture: z.number().int().min(0).max(1_000_000_000).optional(),
  points: z.array(pointSchema).min(1).max(24),
  color: z.number().int().min(0).max(5),
  width: z.union([z.literal(4), z.literal(9), z.literal(18)]),
});
export const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choose'), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal('stroke'), stroke: strokeSchema }),
  z.object({ type: z.literal('clear') }),
  z.object({ type: z.literal('undo') }),
  z.object({ type: z.literal('guess'), text: z.string().min(1).max(40) }),
]);
export type Input = z.infer<typeof inputSchema>;
export type Stroke = z.infer<typeof strokeSchema>;
export type Point = z.infer<typeof pointSchema>;
export type Transition = (state: State, now: number) => State;
export interface State extends GameStateBase {
  order: string[];
  turn: number;
  drawer: string;
  choices: string[];
  word: string;
  strokes: Stroke[];
  inkRevision: number;
  solved: Record<string, number>;
  guesses: Record<string, string[]>;
  feedback: Record<string, string>;
  lastGuessAt: Record<string, number>;
  scores: Record<string, number>;
  gains: Record<string, number>;
  used: string[];
  began: number;
  endsAt: number;
  clock: number;
  hintOrder: number[];
  hintCount: number;
  left: string[];
  phoneOnly: boolean;
  settings: { laps: number; drawSeconds: number; difficulty: string };
}
export interface PublicBoard {
  turn: number;
  turns: number;
  drawer: string;
  drawerName: string;
  mask: string;
  answer?: string;
  strokes: Stroke[];
  inkRevision: number;
  scores: Record<string, number>;
  gains: Record<string, number>;
  solvedIds: string[];
  solvedCount: number;
  guesserCount: number;
  endsAt: number;
  hintCount: number;
}
export interface DrawTvView extends TvView, PublicBoard {}
export interface DrawControllerView extends ControllerView, PublicBoard {
  isDrawer: boolean;
  choices?: string[];
  secret?: string;
  solved: boolean;
  myPoints: number;
  feedback: string;
  lastGuess: string;
  phoneStage: boolean;
  canGuess: boolean;
}
