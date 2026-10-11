// Swept collisions against a convex octagon: a ball cannot tunnel through an edge between samples.
import { nextFloat, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';

export const W = 100;
export const H = 100;
export const CENTER = 50;
export const RADIUS = 44;
export const APOTHEM = RADIUS * Math.cos(Math.PI / 8);
export const PADDLE_HALF = 5.8;
export const BALL_RADIUS = 0.85;
export const STEP_MS = 20;
export const TICK_MS = 100;
export const ROUND_MS = 60_000;
export const SPAWN_EVERY_MS = 15_000;
export const MAX_BALLS = 4;
export const INITIAL_LIVES = 5;
export const RESPAWN_MS = 700;
export const SPEED = 26;
export const MAX_SPEED = 52;
export const SAVES_CAP = 999;
const EPS = 0.000001;

export interface Point {
  x: number;
  y: number;
}
export interface Edge {
  slot: number;
  a: Point;
  b: Point;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
  mx: number;
  my: number;
  length: number;
}
export interface Paddle {
  id: string;
  /** Edge index. Unoccupied and eliminated edges become solid walls. */
  slot: number;
  position: number;
  lives: number;
  saves: number;
  eliminatedAt: number | null;
  /** Last physics sample on which this paddle moved; bots decide at most once per sample. */
  movedAt?: number;
}
export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Spawn/respawn release time in milliseconds after began. */
  readyAt: number;
  /** Number of misses since this ball joined; advances its next seeded serve around the arena. */
  rallies?: number;
}
export interface World {
  paddles: Paddle[];
  balls: Ball[];
  stepped: number;
  /** Four seed-drawn launch directions, fixed for this match. */
  spawnAngles: number[];
}
/** Views expose the live arena, never seed-drawn future serves. */
export type PublicWorld = Omit<World, 'spawnAngles'>;

export const VERTICES: readonly Point[] = Array.from({ length: 8 }, (_, i) => ({
  x: CENTER + RADIUS * Math.cos(-Math.PI / 8 + (i * Math.PI) / 4),
  y: CENTER + RADIUS * Math.sin(-Math.PI / 8 + (i * Math.PI) / 4),
}));
export const EDGES: readonly Edge[] = VERTICES.map((a, slot) => {
  const b = VERTICES[(slot + 1) % 8] as Point;
  const angle = (slot * Math.PI) / 4;
  return {
    slot,
    a,
    b,
    nx: Math.cos(angle),
    ny: Math.sin(angle),
    tx: -Math.sin(angle),
    ty: Math.cos(angle),
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
    length: Math.hypot(b.x - a.x, b.y - a.y),
  };
});

export const inputSchema = z.object({
  type: z.literal('move'),
  position: z.number().finite().min(0).max(1),
});
export type Input = z.infer<typeof inputSchema>;

export function paddleCenter(paddle: Paddle): Point {
  const edge = EDGES[paddle.slot] as Edge;
  const offset = (paddle.position * 2 - 1) * (edge.length / 2 - PADDLE_HALF);
  return { x: edge.mx + edge.tx * offset, y: edge.my + edge.ty * offset };
}

export const aliveCount = (world: World): number => world.paddles.filter((p) => p.lives > 0).length;
export const finished = (world: World): boolean =>
  world.paddles.length > 1 && aliveCount(world) <= 1;

function spawn(id: number, angle: number, now: number): Ball {
  return {
    id,
    x: CENTER,
    y: CENTER,
    vx: Math.cos(angle) * SPEED,
    vy: Math.sin(angle) * SPEED,
    readyAt: now,
    rallies: 0,
  };
}

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let next = rng;
  const spawnAngles: number[] = [];
  for (let i = 0; i < MAX_BALLS; i++) {
    const [value, after] = nextFloat(next);
    next = after;
    spawnAngles.push(value * Math.PI * 2);
  }
  const seats = ids.slice(0, 8);
  const paddles = seats.map((id, index): Paddle => ({
    id,
    slot: Math.floor((index * 8) / seats.length),
    position: 0.5,
    lives: INITIAL_LIVES,
    saves: 0,
    eliminatedAt: null,
  }));
  return [{ paddles, balls: [spawn(0, spawnAngles[0] ?? 0, 0)], stepped: 0, spawnAngles }, next];
}

/** Earliest outward crossing of the inset octagon; radius is included in its plane. */
export function firstCollision(ball: Ball, seconds: number): { edge: Edge; time: number } | null {
  let first: { edge: Edge; time: number } | null = null;
  for (const edge of EDGES) {
    const outward = ball.vx * edge.nx + ball.vy * edge.ny;
    if (outward <= EPS) continue;
    const distance = (ball.x - CENTER) * edge.nx + (ball.y - CENTER) * edge.ny;
    const time = Math.max(0, (APOTHEM - BALL_RADIUS - distance) / outward);
    if (time <= seconds + EPS && (first === null || time < first.time - EPS)) {
      first = { edge, time };
    }
  }
  return first;
}

function reflect(ball: Ball, edge: Edge): Ball {
  const dot = ball.vx * edge.nx + ball.vy * edge.ny;
  return { ...ball, vx: ball.vx - 2 * dot * edge.nx, vy: ball.vy - 2 * dot * edge.ny };
}

/** A bounded loop handles even a corner's two simultaneous plane contacts. */
function moveBall(
  ball: Ball,
  paddles: Paddle[],
  from: number,
  to: number,
  launchAngle: number,
): Ball {
  if (ball.readyAt >= to) return ball;
  let remaining = (to - Math.max(from, ball.readyAt)) / 1000;
  let moving = { ...ball };
  // Defensive speed bound also protects hand-built fixtures and hostile replay inputs.
  const speed = Math.hypot(moving.vx, moving.vy);
  if (speed > MAX_SPEED) {
    moving.vx *= MAX_SPEED / speed;
    moving.vy *= MAX_SPEED / speed;
  }
  for (let contacts = 0; remaining > EPS && contacts < 8; contacts++) {
    const collision = firstCollision(moving, remaining);
    if (!collision)
      return {
        ...moving,
        x: moving.x + moving.vx * remaining,
        y: moving.y + moving.vy * remaining,
      };
    const { edge, time } = collision;
    moving.x += moving.vx * time;
    moving.y += moving.vy * time;
    remaining -= time;
    const seat = paddles.find((p) => p.slot === edge.slot && p.lives > 0);
    if (seat) {
      const center = paddleCenter(seat);
      const offset = (moving.x - center.x) * edge.tx + (moving.y - center.y) * edge.ty;
      if (Math.abs(offset) > PADDLE_HALF + BALL_RADIUS) {
        seat.lives = Math.max(0, seat.lives - 1);
        if (seat.lives === 0) seat.eliminatedAt = to;
        // Rotate each seed-drawn serve by the golden angle: a miss does not trap the rally
        // between the same two opposite sides, and its 700 ms grace remains visible.
        const rallies = (moving.rallies ?? 0) + 1;
        const angle = launchAngle + rallies * Math.PI * (3 - Math.sqrt(5));
        return {
          ...moving,
          x: CENTER,
          y: CENTER,
          vx: Math.cos(angle) * SPEED,
          vy: Math.sin(angle) * SPEED,
          readyAt: to + RESPAWN_MS,
          rallies,
        };
      }
      seat.saves = Math.min(SAVES_CAP, seat.saves + 1);
      const deflection = Math.max(-0.8, Math.min(0.8, (offset / PADDLE_HALF) * 0.8));
      const speedAfter = Math.min(
        MAX_SPEED,
        Math.max(SPEED, Math.hypot(moving.vx, moving.vy)) * 1.025,
      );
      const scale = speedAfter / Math.hypot(1, deflection);
      moving.vx = (-edge.nx + edge.tx * deflection) * scale;
      moving.vy = (-edge.ny + edge.ty * deflection) * scale;
    } else moving = reflect(moving, edge);
    // Move inside the struck plane so zero-time corner contacts cannot repeat forever.
    moving.x -= edge.nx * EPS * 2;
    moving.y -= edge.ny * EPS * 2;
  }
  return moving;
}

/** Time is quantized to a fixed grid, so catching up in one or many events gives identical state. */
export function tick(world: World, to: number): World {
  if (!Number.isFinite(to)) return world;
  const last = Math.floor(Math.max(0, Math.min(ROUND_MS, to)) / STEP_MS);
  if (last <= world.stepped || finished(world)) return world;
  const paddles = world.paddles.map((p) => ({ ...p }));
  let balls = world.balls.map((b) => ({ ...b }));
  let stepped = world.stepped;
  for (let sample = world.stepped + 1; sample <= last; sample++) {
    const now = sample * STEP_MS;
    const count = Math.min(MAX_BALLS, 1 + Math.floor(now / SPAWN_EVERY_MS));
    while (balls.length < count) {
      const id = balls.length;
      balls.push(spawn(id, world.spawnAngles[id] ?? 0, now));
    }
    balls = balls.map((b) =>
      moveBall(b, paddles, now - STEP_MS, now, world.spawnAngles[b.id] ?? 0),
    );
    stepped = sample;
    if (paddles.length > 1 && paddles.filter((p) => p.lives > 0).length <= 1) break;
  }
  return { ...world, paddles, balls, stepped };
}

export function apply(world: World, id: string, input: Input): World {
  const index = world.paddles.findIndex((p) => p.id === id);
  const seat = world.paddles[index];
  if (
    !seat ||
    seat.lives <= 0 ||
    input?.type !== 'move' ||
    !Number.isFinite(input.position) ||
    input.position < 0 ||
    input.position > 1 ||
    seat.position === input.position
  )
    return world;
  return {
    ...world,
    paddles: world.paddles.map((p, i) =>
      i === index ? { ...p, position: input.position, movedAt: world.stepped } : p,
    ),
  };
}
