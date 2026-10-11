// JSON-only state for a simultaneous tower race.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'reveal', 'done'] as const;
export const ROUND_MS = 60_000;
export const REVEAL_MS = 6500;
export const TICK_MS = 200;
export const STEP_MS = 20;
export const HOLD_MS = 800;
export const RESPAWN_MS = 1200;
export const ROTATION_SPEED = 150;
export const GRAVITY = 14;
export const BOUNCE = -4.2;
export const MAX_FALL = 8;
export const FLOOR_COUNT = 120;

export const inputSchema = z.object({
  type: z.literal('rotate'),
  dir: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
export type Input = z.infer<typeof inputSchema>;

export interface Ring {
  gap: number;
  width: number;
  danger: number;
  dangerWidth: number;
}

export interface Runner {
  id: string;
  angle: number;
  dir: -1 | 0 | 1;
  heldUntil: number;
  y: number;
  vy: number;
  floor: number;
  chain: number;
  best: number;
  lives: number;
  respawnAt: number | null;
  crashed: number;
  smashes: number;
  cleared: boolean;
}

export interface State extends GameStateBase {
  tower: Ring[];
  runners: Runner[];
  began: number;
  endsAt: number;
  checked: number;
  phoneOnly: boolean;
  settings: { lives: number };
}

export type Transition = (state: State, now: number) => State;
