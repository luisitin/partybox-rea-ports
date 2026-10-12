// JSON state of the match and absolute-heading controller inputs.
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'done'] as const;
export const STEP_MS = 100;
export const ROUND_MS = 90_000;
export const SCORE_MS = 7000;
export const W = 160;
export const H = 100;
export const SPEED = 16;
export const BODY_SPACING = 1.6;
export const BOT_DECISION_MS = 1000;
export const BOOST_SPEED = 28;
export const TURN_RATE = 3.5;
export const MIN_MASS = 8;
export const START_MASS = 14;
export const MAX_MASS = 90;
export const BOOST_COST = 0.3;
export const RADIUS = 1.5;
export const RESPAWN_MS = 2000;
export const GRACE_MS = 1000;
export const FOOD_COUNT = 70;
export const MAX_FOOD = 240;

export const inputSchema = z.object({
  type: z.literal('steer'),
  angle: z.number().finite().min(-Math.PI).max(Math.PI),
  boost: z.boolean(),
});
export type Input = z.infer<typeof inputSchema>;
export type Point = [number, number];
export interface Snake {
  id: string;
  body: Point[];
  angle: number;
  target: number;
  boost: boolean;
  mass: number;
  respawnAt: number | null;
  safeUntil: number;
  crashes: number;
  steeredAt?: number;
}
export interface Food {
  x: number;
  y: number;
  value: number;
}
export interface World {
  snakes: Snake[];
  food: Food[];
  elapsed: number;
}
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  round: number;
  settings: { rounds: number };
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
