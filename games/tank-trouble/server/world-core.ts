// Fixed-step, public tank physics. All clocks are milliseconds after the round began.
import { z } from '@partybox/game-sdk';

export const W = 160;
export const H = 96;
export const CELL = 16;
export const COLS = W / CELL;
export const ROWS = H / CELL;
export const STEP_MS = 20;
export const TICK_MS = 200;
export const ROUND_MS = 45_000;
export const SPEED = 19;
export const OMEGA = 2.6;
export const TANK_RADIUS = 3;
export const SHELL_RADIUS = 0.65;
export const SHELL_SPEED = 43;
export const SHELL_MS = 10_000;
export const MAX_SHELLS = 5;
export const RELOAD_MS = 420;
export const INPUT_LEASE_MS = 1200;
export const SPAWN_SAFE_MS = 700;
export const OWNER_SAFE_MS = 100;
export const BOT_BEAT_MS = 600;
export const POWERUP_KINDS = ['scatter', 'beam', 'guided'] as const;
export type PowerupKind = (typeof POWERUP_KINDS)[number];
export type Weapon = 'shell' | PowerupKind;

export const inputSchema = z.object({
  type: z.literal('control'),
  drive: z.number().int().min(-1).max(1),
  turn: z.number().min(-1).max(1),
  fire: z.boolean(),
  pulse: z.boolean().optional(),
});
export type Input = z.infer<typeof inputSchema>;
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Maze {
  cols: number;
  rows: number;
  cell: number;
  walls: Wall[];
  /** Public passage graph; generated alongside walls. Hand-built test mazes can omit it. */
  passages?: number[][];
}
export interface Tank {
  id: string;
  slot: number;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  died: number | null;
  drive: number;
  turn: number;
  fire: boolean;
  /** A one-volley input; ordinary held Fire leaves this false. */
  firePulse: boolean;
  /** Last accepted controls, their lease and the next permitted shot, on the round clock. */
  controlAt: number;
  inputUntil: number;
  reloadAt: number;
  weapon: Weapon;
  weaponAmmo: number;
  weaponUntil: number;
  /** Free shell capacity, or special shots remaining. */
  ammo: number;
}
export interface Bullet {
  id: number;
  owner: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  bounces: number;
  kind: Weapon;
}
export interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: PowerupKind;
}
export interface Arena {
  maze: Maze;
  tanks: Tank[];
  bullets: Bullet[];
  pickups: Pickup[];
  /** Last completed fixed step index (the snapshot time is stepped * STEP_MS). */
  stepped: number;
}
export interface World extends Arena {
  nextBullet: number;
  safeUntil: number;
}
export interface Point {
  x: number;
  y: number;
}
export const round = (n: number): number => Math.round(n * 1e6) / 1e6 || 0;
export const angleDelta = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a)) || 0;
export const sq = (a: Point, b: Point): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function makeTank(id: string, slot: number, x: number, y: number, angle = 0): Tank {
  return {
    id,
    slot,
    x,
    y,
    angle,
    alive: true,
    died: null,
    drive: 0,
    turn: 0,
    fire: false,
    firePulse: false,
    controlAt: -BOT_BEAT_MS,
    inputUntil: 0,
    reloadAt: 0,
    weapon: 'shell',
    weaponAmmo: 0,
    weaponUntil: 0,
    ammo: MAX_SHELLS,
  };
}
