import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'goal', 'halftime', 'done'] as const;
export const STEP_MS = 50;
export const BEAT_MS = 100;
export const LEASE_MS = 650;
export const GOAL_MS = 2000;
export const HALFTIME_MS = 8000;
export const KICK_COOLDOWN_MS = 250;
export const W = 160;
export const H = 100;
export const PLAYER_R = 4;
export const BALL_R = 2;
export const GOAL_HALF = 18;
export const GOAL_DEPTH = 10;
export const POST_R = 1.5;
export const PLAYER_SPEED = 24;
export const BALL_SPEED = 48;
export const KICK_RANGE = PLAYER_R + BALL_R + 1.2;

export const inputSchema = z.object({
  type: z.literal('control'),
  phaseAt: z.number().finite(),
  seq: z.number().int().min(0).max(2147483647),
  dx: z.number().int().min(-1).max(1),
  dy: z.number().int().min(-1).max(1),
  kick: z.boolean(),
});
export type Input = z.infer<typeof inputSchema>;
export type Team = 'red' | 'blue';
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Disc extends Body {
  id: string;
  team: Team;
  number: number;
  helper: boolean;
}
export interface Intent {
  seq: number;
  dx: number;
  dy: number;
  until: number;
  kickHeld: boolean;
  kickArmed: boolean;
  kickReadyAt: number;
  lastKickAt: number | null;
}
export interface Goal {
  team: Team;
  scorerId: string | null;
  ownGoal: boolean;
}
export interface State extends GameStateBase {
  half: 1 | 2;
  halfSeconds: number;
  clock: number;
  simAt: number;
  halfEndsAt: number;
  teams: Record<string, Team>;
  goals: Record<Team, number>;
  discs: Disc[];
  ball: Body;
  intents: Record<string, Intent>;
  redAttacksRight: boolean;
  lastGoal: Goal | null;
  lastTouch: string | null;
  left: string[];
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;

export function neutral(intent?: Intent): Intent {
  return {
    seq: intent?.seq ?? -1,
    dx: 0,
    dy: 0,
    until: 0,
    kickHeld: false,
    kickArmed: false,
    kickReadyAt: intent?.kickReadyAt ?? 0,
    lastKickAt: intent?.lastKickAt ?? null,
  };
}
