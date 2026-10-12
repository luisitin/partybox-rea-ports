// JSON state and public view types. Future spawn draws stay server-side.
import { z } from '@partybox/game-sdk';
import type { ControllerView, GameStateBase, TvView } from '@partybox/game-sdk';

export const PHASES = ['play', 'reveal', 'done'] as const;
export const TARGET = 2048;
/** Minimum settling beat; the actual reveal also covers every visible word. */
export const REVEAL_MS = 8000;
export const MOVE_MS = 150;
export const MAX_MOVES = 1200;
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const inputSchema = z.object({
  type: z.literal('move'),
  dir: z.enum(DIRECTIONS),
  move: z.number().int().min(0).max(MAX_MOVES),
});
export type Input = z.infer<typeof inputSchema>;
export interface Spawn {
  slot: number;
  value: 2 | 4;
}
export interface Racer {
  board: number[];
  score: number;
  moves: number;
  lastAt: number;
  status: 'racing' | 'blocked' | 'finished';
}
export type EndReason = 'target' | 'clock' | 'blocked' | 'host' | null;
export interface State extends GameStateBase {
  racers: Record<string, Racer>;
  spawns: Spawn[];
  settings: { seconds: number };
  phoneOnly: boolean;
  reason: EndReason;
}
export interface RacerView {
  id: string;
  board: number[];
  score: number;
  best: number;
  moves: number;
  status: Racer['status'];
  rank: number;
}
export interface RaceView {
  racers: RacerView[];
  winners: string[];
  reason: EndReason;
  target: number;
}
export interface TvMergeView extends TvView, RaceView {}
export interface ControllerMergeView extends ControllerView, RaceView {
  mine: RacerView | null;
}
