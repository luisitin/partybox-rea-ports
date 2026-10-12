import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['ready', 'play', 'score', 'done'] as const;
export const READY_MS = 4000;
export const SCORE_MS = 7000;
export const ROUND_MS = 120000;
export const TICK_MS = 200;
export const WIDTH = 40;
export const HEIGHT = 28;
export const RESPAWN_TICKS = 15;
export type Direction = 0 | 1 | 2 | 3; // Up, right, down, left. Absolute screen directions.
export type Input = { type: 'direction'; dir: Direction };
export interface Runner {
  id: string;
  slot: number;
  home: number;
  cell: number;
  dir: Direction;
  queued: Direction;
  trail: number[];
  alive: boolean;
  respawnTick: number | null;
  deaths: number;
  area: number;
  captures: number;
  lastCapture: number;
  cause: 'wall' | 'trail' | 'head' | 'cut' | 'connection' | null;
}
export interface World {
  width: number;
  height: number;
  owners: number[]; // -1 neutral, otherwise stable runner slot.
  homes: number[]; // Permanent 3x3 safe ownership; opponents may travel through it.
  runners: Runner[];
  stepped: number;
}
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  checked: number; // Milliseconds judged from began, always a multiple of TICK_MS.
  scores: Record<string, number>;
  left: string[];
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
