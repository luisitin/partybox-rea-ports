// JSON state and view payloads for the simultaneous sixty-second fountain.
import type { ControllerView, GameStateBase, TvView, z } from '@partybox/game-sdk';
import type { inputSchema } from './world';

export const PHASES = ['play', 'score', 'done'] as const;
export const ROUND_MS = 60_000;
export const WAVE_MS = 2000;
export const TICK_MS = 200;
export type Input = z.infer<typeof inputSchema>;
export type Point = { x: number; y: number };
export interface Fruit {
  id: number;
  kind: number;
  x: number;
  drift: number;
  peak: number;
  bomb: boolean;
}
export interface Seat {
  score: number;
  streak: number;
  bestCombo: number;
  cut: number[];
  bombed: boolean;
  hitWave: boolean;
  strokes: number;
  lastSeq: number;
  feedback: string;
  feedbackPoints: number;
}
export interface State extends GameStateBase {
  began: number;
  endsAt: number;
  checked: number;
  wave: number;
  fruit: Fruit[];
  seats: Record<string, Seat>;
  phoneOnly: boolean;
}
export interface Target extends Point {
  id: number;
  kind: number;
  bomb: boolean;
  radius: number;
}
export interface Row {
  id: string;
  name: string;
  score: number;
  gain: number;
  streak: number;
  bestCombo: number;
  bombed: boolean;
}
export interface SliceTvView extends TvView {
  wave: number;
  frame: number;
  targets: Target[];
  rows: Row[];
  seconds: number;
}
export interface SliceControllerView extends ControllerView {
  wave: number;
  frame: number;
  targets: Target[];
  rows: Row[];
  seconds: number;
  score: number;
  streak: number;
  bestCombo: number;
  bombed: boolean;
  lastSeq: number;
  feedback: string;
  feedbackPoints: number;
  stage: boolean;
}
export type Transition = (state: State, now: number) => State;
