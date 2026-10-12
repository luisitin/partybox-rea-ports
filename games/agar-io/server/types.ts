// Match state and public input types. All physics clocks are relative to began.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'done'] as const;
export const ROUND_MS = 90_000;
export const SCORE_MS = 6500;
export const STEP_MS = 100;
export const WAKE_MS = 200;
export const W = 160;
export const H = 100;
export const START_MASS = 24;
export const PELLET_MASS = 3;
export const PELLET_COUNT = 96;
export const EAT_RATIO = 1.25;
export const SPLIT_MIN = 48;
export const MAX_CELLS = 4;
export const MERGE_MS = 8000;
export const SPLIT_COOLDOWN_MS = 1000;
export const RESPAWN_MS = 3000;
export const SHIELD_MS = 2000;

export const inputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('steer'),
    x: z.number().finite().min(-1).max(1),
    y: z.number().finite().min(-1).max(1),
  }),
  z.object({ type: z.literal('split') }),
]);
export type Input = z.infer<typeof inputSchema>;
export interface Cell {
  id: number;
  owner: string;
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  mergeAt: number;
  shieldUntil: number;
}
export interface Pellet {
  id: number;
  x: number;
  y: number;
}
export interface Control {
  x: number;
  y: number;
  at: number;
  splitAt: number;
}
export interface World {
  time: number;
  serial: number;
  cells: Cell[];
  pellets: Pellet[];
  controls: Record<string, Control>;
  respawns: Record<string, number>;
}
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  round: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  phoneOnly?: true;
  left: string[];
}
export type Transition = (state: State, now: number) => State;
