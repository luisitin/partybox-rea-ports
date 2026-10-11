import { nextInt, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';

export const ROUND_MS = 60_000;
export const STEP_MS = 20;
export const TICK_MS = 100;
export const START_SPEED = 360;
export const ACCELERATION = 3.6;
export const MAX_SPEED = 780;
export const JUMP_VELOCITY = 630;
export const GRAVITY = 1800;
export const JUMP_MS = (2 * JUMP_VELOCITY * 1000) / GRAVITY;
export const RUNNER_X = 80;
export const RUNNER_WIDTH = 30;
export const RUNNER_HEIGHT = 42;
export const DUCK_HEIGHT = 22;
export const VISIBLE_AHEAD = 520;

export const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('jump') }),
  z.object({ type: z.literal('duck'), down: z.boolean() }),
]);
export type Input = z.infer<typeof inputSchema>;
export interface Obstacle {
  id: number;
  x: number;
  width: number;
  bottom: number;
  height: number;
  kind: 'rock' | 'bird';
}
export interface Runner {
  id: string;
  jumpAt: number | null;
  duck: boolean;
  died: number | null;
  distance: number;
  changes: number;
}
export interface World {
  runners: Runner[];
  course: Obstacle[];
  checked: number;
  cursor: number;
}
export const speedAt = (ms: number): number =>
  Math.min(MAX_SPEED, START_SPEED + ACCELERATION * Math.max(0, ms) / 1000);

/** Integrated speed, including the capped tail. All lanes use this same distance. */
export function distanceAt(ms: number): number {
  const t = Math.max(0, ms) / 1000;
  const ramp = Math.min(t, (MAX_SPEED - START_SPEED) / ACCELERATION);
  return START_SPEED * ramp + 0.5 * ACCELERATION * ramp * ramp + MAX_SPEED * (t - ramp);
}
export function heightAt(runner: Runner, ms: number): number {
  if (runner.jumpAt === null) return 0;
  const t = Math.max(0, ms - runner.jumpAt) / 1000;
  return Math.max(0, JUMP_VELOCITY * t - 0.5 * GRAVITY * t * t);
}
export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let r = rng;
  let at = 3000;
  const course: Obstacle[] = [];
  let lastBird = false;
  while (at <= ROUND_MS + 2000) {
    let kind: number, width: number, gap: number;
    [kind, r] = nextInt(r, 0, 2);
    [width, r] = nextInt(r, 24, 42);
    [gap, r] = nextInt(r, 1450, 2100);
    const bird: boolean = at > 12_000 && kind === 0 && !lastBird;
    course.push({
      id: course.length,
      x: distanceAt(at) + RUNNER_X,
      width,
      bottom: bird ? 32 : 0,
      height: bird ? 34 : 35 + course.length % 3 * 10,
      kind: bird ? 'bird' : 'rock',
    });
    lastBird = bird;
    at += gap;
  }
  return [{
    runners: ids.map((id) => ({ id, jumpAt: null, duck: false, died: null, distance: 0, changes: 0 })),
    course,
    checked: 0,
    cursor: 0,
  }, r];
}
export const allDead = (world: World): boolean =>
  world.runners.every((r) => r.died !== null);

/** Strict AABB contact; 20 ms sampling prevents tunnelling at the speed cap. */
export function collides(runner: Runner, obstacle: Obstacle, ms: number): boolean {
  const x = obstacle.x - distanceAt(ms);
  if (x >= RUNNER_X + RUNNER_WIDTH || x + obstacle.width <= RUNNER_X) return false;
  const bottom = heightAt(runner, ms);
  const height = bottom === 0 && runner.duck ? DUCK_HEIGHT : RUNNER_HEIGHT;
  return bottom < obstacle.bottom + obstacle.height && bottom + height > obstacle.bottom;
}
export function tick(world: World, to: number): World {
  const end = Math.min(ROUND_MS, Math.max(0, Math.floor(to / STEP_MS) * STEP_MS));
  if (end <= world.checked || allDead(world)) return world;
  const runners = world.runners.map((r) => ({ ...r }));
  let cursor = world.cursor;
  let checked = world.checked;
  for (let ms = world.checked + STEP_MS; ms <= end; ms += STEP_MS) {
    const distance = distanceAt(ms);
    while (cursor < world.course.length &&
      world.course[cursor]!.x + world.course[cursor]!.width < distance + RUNNER_X) cursor++;
    for (const runner of runners) {
      if (runner.died !== null) continue;
      runner.distance = distance;
      if (runner.jumpAt !== null && ms - runner.jumpAt >= JUMP_MS) runner.jumpAt = null;
      const obstacle = world.course[cursor];
      if (obstacle && collides(runner, obstacle, ms)) runner.died = ms;
    }
    checked = ms;
    if (runners.every((r) => r.died !== null)) break;
  }
  return { ...world, runners, checked, cursor };
}
export function apply(world: World, id: string, input: Input, at: number): World {
  const runner = world.runners.find((r) => r.id === id);
  if (!runner || runner.died !== null || at < world.checked || at < 0) return world;
  let next: Runner;
  if (input.type === 'jump') {
    if ((runner.jumpAt !== null && at - runner.jumpAt < JUMP_MS) || runner.changes >= 600) return world;
    next = { ...runner, jumpAt: at, duck: false, changes: runner.changes + 1 };
  } else {
    if (runner.duck === input.down || (input.down && runner.changes >= 600)) return world;
    next = { ...runner, duck: input.down, changes: runner.changes + 1 };
  }
  return { ...world, runners: world.runners.map((r) => r.id === id ? next : r) };
}
/** Only the next visible obstacles go over the wire; the future course stays on the server. */
export function visibleCourse(world: World): Obstacle[] {
  const distance = distanceAt(world.checked);
  return world.course.filter((o) => o.x + o.width >= distance + RUNNER_X - 60 &&
    o.x <= distance + RUNNER_X + VISIBLE_AHEAD);
}
