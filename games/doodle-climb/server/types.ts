// JSON state and shared geometry for an automatic, horizontally steered climber.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'ready', 'done'] as const;
export const W = 240;
export const H = 320;
export const STEP_MS = 20;
export const TICK_MS = 100;
export const GRAVITY = 600;
export const BOUNCE = 330;
export const SPRING = 440;
export const SPEED = 150;
export const SCORE_MS = 5000;
export const READY_MS = 2500;

export const inputSchema = z.object({
  type: z.literal('steer'),
  dir: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
export type Input = z.infer<typeof inputSchema>;
export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  kind: 'normal' | 'spring';
}
export interface Climber {
  id: string;
  x: number;
  y: number;
  vy: number;
  dir: -1 | 0 | 1;
  peak: number;
  camera: number;
  died: number | null;
  bounces: number;
}
export interface World {
  platforms: Platform[];
  climbers: Climber[];
  stepped: number;
}
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  elapsed: number;
  round: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  settings: { rounds: number; seconds: number };
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
