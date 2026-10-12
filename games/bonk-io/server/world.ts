import { z } from '@partybox/game-sdk';
import { BALL_RADIUS } from './types';
import type { Ball, Input, Platform, World } from './types';

export type { Ball, Input, Platform, World } from './types';
export { BALL_RADIUS } from './types';
export const W = 960;
export const H = 540;
export const STEP_MS = 40;
export const TICK_MS = 200;
export const ROUND_MS = 30_000;
export const SHRINK_MS = 15_000;
export const VANISH_MS = 28_000;
export const GRAVITY = 950;
export const NORMAL_ACCELERATION = 480;
export const HEAVY_ACCELERATION = 190;
export const NORMAL_SPEED = 250;
export const HEAVY_SPEED = 140;
export const NORMAL_JUMP = 360;
export const HEAVY_JUMP = 230;
export const HEAVY_MASS = 4;
export const RESTITUTION = 0.65;
export const COYOTE_MS = 120;
const SUBSTEPS = 4;
const DT = STEP_MS / SUBSTEPS / 1000;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
const clamp = (n: number, limit: number): number => Math.max(-limit, Math.min(limit, n));

export const inputSchema = z.object({
  type: z.literal('control'),
  move: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  heavy: z.boolean(),
  jump: z.boolean(),
});

/** Authored, symmetric arenas. Every spawn starts on the same broad lower platform. */
export function platformsAt(layout: number, ms: number): Platform[] {
  if (ms >= VANISH_MS) return [];
  const base: Platform[] = [{ id: 'floor', x: 64, y: 400, width: 832, height: 32 }];
  if (layout === 1) {
    base.push(
      { id: 'left-step', x: 8, y: 450, width: 160, height: 24 },
      { id: 'right-step', x: 792, y: 450, width: 160, height: 24 },
    );
  } else if (layout === 2) {
    base.push({ id: 'bridge', x: 320, y: 492, width: 320, height: 24 });
  }
  const fraction = Math.max(0, Math.min(1, (ms - SHRINK_MS) / (VANISH_MS - SHRINK_MS)));
  return base.map((p) => {
    const width = Math.max(8, p.width * (1 - fraction));
    return { ...p, x: round4(p.x + (p.width - width) / 2), width: round4(width) };
  });
}

export function makeWorld(
  ids: string[],
  left: readonly string[],
  round: number,
  offset: number,
): World {
  const count = ids.length;
  const balls = ids.map((id, slot): Ball => {
    // Rotate the allocation without changing a player's visible number.
    const rotated = (slot + round - 1 + offset) % Math.max(1, count);
    const position = rotated;
    const x = count <= 1 ? W / 2 : 104 + (752 * position) / (count - 1);
    const departed = left.includes(id);
    return {
      id,
      slot,
      x: round4(x),
      y: 400 - BALL_RADIUS,
      vx: 0,
      vy: 0,
      alive: !departed,
      move: 0,
      heavy: false,
      grounded: !departed,
      controlAt: -1,
      coyote: departed ? 0 : COYOTE_MS,
      jumpQueued: false,
      diedAt: departed ? 0 : null,
      cause: departed ? 'left' : null,
    };
  });
  return { balls, stepped: 0, layout: (round - 1) % 3 };
}

export const aliveCount = (world: World): number => world.balls.filter((b) => b.alive).length;
export const finished = (world: World): boolean => aliveCount(world) <= 1;

/** Release retained holds on disconnect, pause and phase changes. It never revives a ball. */
export function release(world: World, id?: string): World {
  let changed = false;
  const balls = world.balls.map((b) => {
    if ((id !== undefined && b.id !== id) || (!b.move && !b.heavy && !b.jumpQueued)) return b;
    changed = true;
    return { ...b, move: 0 as const, heavy: false, jumpQueued: false };
  });
  return changed ? { ...world, balls } : world;
}

export function depart(world: World, id: string, ms: number): World {
  return {
    ...world,
    balls: world.balls.map((b) =>
      b.id !== id || (!b.alive && b.cause === 'left')
        ? b
        : {
            ...b,
            alive: false,
            grounded: false,
            move: 0,
            heavy: false,
            jumpQueued: false,
            cause: 'left',
            diedAt: ms,
          },
    ),
  };
}

export function apply(world: World, id: string, input: Input, ms: number): World {
  const index = world.balls.findIndex((b) => b.id === id);
  const ball = world.balls[index];
  if (!ball?.alive || ms < ball.controlAt || ms < world.stepped * STEP_MS) return world;
  const jump = input.jump && (ball.grounded || ball.coyote > 0) && !ball.jumpQueued;
  if (ball.move === input.move && ball.heavy === input.heavy && !jump && ms === ball.controlAt)
    return world;
  return {
    ...world,
    balls: world.balls.map((b, i) =>
      i === index
        ? {
            ...b,
            move: input.move,
            heavy: input.heavy,
            jumpQueued: b.jumpQueued || jump,
            controlAt: ms,
          }
        : b,
    ),
  };
}

/** Solid rectangle contacts, including swept top/bottom/side faces. Substeps bound travel below a radius. */
function platformContact(ball: Ball, previousX: number, previousY: number, p: Platform): void {
  const r = BALL_RADIUS;
  const right = p.x + p.width;
  const bottom = p.y + p.height;
  const horizontal = ball.x >= p.x && ball.x <= right;
  if (horizontal && previousY + r <= p.y + 0.01 && ball.y + r >= p.y && ball.vy >= 0) {
    ball.y = p.y - r;
    ball.vy = 0;
    ball.grounded = true;
    return;
  }
  if (horizontal && previousY - r >= bottom - 0.01 && ball.y - r <= bottom && ball.vy < 0) {
    ball.y = bottom + r;
    ball.vy = 0;
    return;
  }
  const vertical = ball.y + r > p.y && ball.y - r < bottom;
  if (vertical && previousX + r <= p.x && ball.x + r >= p.x && ball.vx > 0) {
    ball.x = p.x - r;
    ball.vx = -ball.vx * 0.15;
    return;
  }
  if (vertical && previousX - r >= right && ball.x - r <= right && ball.vx < 0) {
    ball.x = right + r;
    ball.vx = -ball.vx * 0.15;
    return;
  }
  const nearX = Math.max(p.x, Math.min(right, ball.x));
  const nearY = Math.max(p.y, Math.min(bottom, ball.y));
  const dx = ball.x - nearX;
  const dy = ball.y - nearY;
  const distance = Math.hypot(dx, dy);
  if (distance >= r || distance === 0) return;
  const nx = dx / distance;
  const ny = dy / distance;
  ball.x += nx * (r - distance);
  ball.y += ny * (r - distance);
  const inward = ball.vx * nx + ball.vy * ny;
  if (inward < 0) {
    ball.vx -= inward * nx;
    ball.vy -= inward * ny;
  }
  if (ny < -0.5) ball.grounded = true;
}

/** All pair impulses are accumulated from one shared snapshot, then applied together. */
function contacts(
  balls: Ball[],
  changes: Float64Array,
  grounded: Uint8Array,
  order: number[] | null,
): void {
  changes.fill(0);
  grounded.fill(0);
  for (let first = 0; first < balls.length; first++) {
    const i = order?.[first] ?? first;
    const a = balls[i];
    if (!a?.alive) continue;
    for (let second = first + 1; second < balls.length; second++) {
      const j = order?.[second] ?? second;
      const b = balls[j];
      if (!b?.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) >= BALL_RADIUS * 2 || Math.abs(dy) >= BALL_RADIUS * 2) continue;
      const distance = Math.hypot(dx, dy);
      if (distance >= BALL_RADIUS * 2) continue;
      // The tie normal is determined by stable slots, even if the array is reordered.
      const nx = distance > 0.0001 ? dx / distance : a.slot < b.slot ? 1 : -1;
      const ny = distance > 0.0001 ? dy / distance : 0;
      const ia = a.heavy ? 1 / HEAVY_MASS : 1;
      const ib = b.heavy ? 1 / HEAVY_MASS : 1;
      const inverse = ia + ib;
      const penetration = BALL_RADIUS * 2 - distance;
      const ai = i * 4;
      const bi = j * 4;
      changes[ai] = changes[ai]! - (nx * penetration * ia) / inverse;
      changes[ai + 1] = changes[ai + 1]! - (ny * penetration * ia) / inverse;
      changes[bi] = changes[bi]! + (nx * penetration * ib) / inverse;
      changes[bi + 1] = changes[bi + 1]! + (ny * penetration * ib) / inverse;
      const approaching = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approaching < 0) {
        const impulse = (-(1 + RESTITUTION) * approaching) / inverse;
        changes[ai + 2] = changes[ai + 2]! - impulse * nx * ia;
        changes[ai + 3] = changes[ai + 3]! - impulse * ny * ia;
        changes[bi + 2] = changes[bi + 2]! + impulse * nx * ib;
        changes[bi + 3] = changes[bi + 3]! + impulse * ny * ib;
      }
      if (ny > 0.65) grounded[i] = 1;
      if (ny < -0.65) grounded[j] = 1;
    }
  }
  balls.forEach((ball, i) => {
    if (!ball.alive) return;
    const at = i * 4;
    ball.x += changes[at]!;
    ball.y += changes[at + 1]!;
    ball.vx = clamp(ball.vx + changes[at + 2]!, 550);
    ball.vy = clamp(ball.vy + changes[at + 3]!, 900);
    ball.grounded ||= grounded[i] === 1;
  });
}

function oneStep(world: World, step: number): World {
  const ms = step * STEP_MS;
  const platforms = platformsAt(world.layout, ms);
  const balls = world.balls.map((ball) => ({ ...ball }));
  // Scratch buffers never escape into JSON state. Reuse them across the four contact substeps.
  const previous = new Float64Array(balls.length * 2);
  const impulses = new Float64Array(balls.length * 4);
  const grounded = new Uint8Array(balls.length);
  const order = balls.every((b, i) => b.slot === i)
    ? null
    : balls.map((_, i) => i).sort((a, b) => balls[a]!.slot - balls[b]!.slot);
  for (const ball of balls) {
    if (!ball.alive) continue;
    if (ball.jumpQueued && (ball.grounded || ball.coyote > 0)) {
      ball.vy = -(ball.heavy ? HEAVY_JUMP : NORMAL_JUMP);
      ball.grounded = false;
      ball.coyote = 0;
    }
    ball.jumpQueued = false;
  }
  for (let sub = 0; sub < SUBSTEPS; sub++) {
    balls.forEach((b, i) => {
      previous[i * 2] = b.x;
      previous[i * 2 + 1] = b.y;
    });
    for (let index = 0; index < balls.length; index++) {
      const ball = balls[index]!;
      if (!ball.alive) continue;
      const acceleration = ball.heavy ? HEAVY_ACCELERATION : NORMAL_ACCELERATION;
      const speed = ball.heavy ? HEAVY_SPEED : NORMAL_SPEED;
      if (ball.move) {
        // Input accelerates only up to its own speed. A stronger bump is allowed to carry the ball faster.
        if (ball.vx * ball.move < speed) {
          const along = Math.min(speed, ball.vx * ball.move + acceleration * DT);
          ball.vx = along * ball.move;
        } else if (ball.vx * ball.move > speed) {
          ball.vx *= Math.max(0, 1 - (ball.heavy ? 3 : 0.8) * DT);
        }
      } else {
        ball.vx *= Math.max(0, 1 - (ball.grounded ? 5 : 0.6) * DT);
      }
      ball.vx = clamp(ball.vx, 550);
      ball.vy = Math.min(900, ball.vy + GRAVITY * DT);
      ball.x += ball.vx * DT;
      ball.y += ball.vy * DT;
      ball.grounded = false;
      for (const p of platforms)
        platformContact(ball, previous[index * 2]!, previous[index * 2 + 1]!, p);
    }
    contacts(balls, impulses, grounded, order);
    balls.forEach((ball, index) => {
      if (!ball.alive) return;
      // Bumps cannot push a ball through a solid platform's top face.
      for (const p of platforms)
        platformContact(ball, previous[index * 2]!, previous[index * 2 + 1]!, p);
      ball.coyote = ball.grounded ? COYOTE_MS : Math.max(0, ball.coyote - STEP_MS / SUBSTEPS);
      ball.x = round4(ball.x);
      ball.y = round4(ball.y);
      ball.vx = round4(ball.vx);
      ball.vy = round4(ball.vy);
    });
  }
  // Falls are judged together after the complete step; no first-in-array survivor can score early.
  for (const ball of balls) {
    if (
      ball.alive &&
      (ball.x + BALL_RADIUS < 0 || ball.x - BALL_RADIUS > W || ball.y - BALL_RADIUS > H)
    ) {
      ball.alive = false;
      ball.grounded = false;
      ball.move = 0;
      ball.heavy = false;
      ball.jumpQueued = false;
      ball.cause = 'fall';
      ball.diedAt = ms;
    }
    // Bound even a dead ball's last drawing position. No history grows across the game.
    ball.x = Math.max(-BALL_RADIUS * 2, Math.min(W + BALL_RADIUS * 2, ball.x));
    ball.y = Math.max(-H, Math.min(H + BALL_RADIUS * 2, ball.y));
  }
  return { ...world, balls, stepped: step };
}

/** Advance once on the absolute grid. Partitioning an idle interval cannot change its physics. */
export function tick(world: World, to: number): World {
  const last = Math.min(Math.floor(Math.max(0, to) / STEP_MS), ROUND_MS / STEP_MS);
  if (last <= world.stepped || finished(world)) return world;
  let out = world;
  for (let step = world.stepped + 1; step <= last; step++) {
    out = oneStep(out, step);
    if (finished(out)) break;
  }
  return out;
}
