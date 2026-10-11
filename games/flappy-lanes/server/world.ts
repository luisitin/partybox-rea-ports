// Analytic flight and collision checks on a fixed grid. Numerical constants are PartyBox tuning.
import { nextInt, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';

export const W = 140;
export const H = 100;
export const X = 28;
export const R = 3;
export const GAP = 38;
export const GATE_WIDTH = 12;
export const SPEED = 26;
export const GRAVITY = 80;
export const FLAP_V = -28;
export const FALL_V = 48;
export const STEP_MS = 20;
export const TICK_MS = 100;
export const ROUND_MS = 45_000;
export const COOLDOWN_MS = 120;
export interface Bird {
  id: string;
  flight: { at: number; y: number; v: number };
  died: number | null;
  passed: number;
  lastFlap: number;
}
export interface Gate {
  x: number;
  center: number;
}
export interface World {
  birds: Bird[];
  course: Gate[];
  checked: number;
}
export const inputSchema = z.object({ type: z.literal('flap') }).strict();
export type Input = z.infer<typeof inputSchema>;

/** Terminal downward speed limits long falls, while a tap resets (never adds) upward velocity. */
export function birdPosition(bird: Bird, t: number): { y: number; v: number } {
  const end = bird.died === null ? t : Math.min(t, bird.died);
  const dt = Math.max(0, end - bird.flight.at) / 1000;
  const accelerated = Math.min(dt, Math.max(0, (FALL_V - bird.flight.v) / GRAVITY));
  const y =
    bird.flight.y +
    bird.flight.v * accelerated +
    (GRAVITY * accelerated ** 2) / 2 +
    FALL_V * (dt - accelerated);
  return { y, v: Math.min(FALL_V, bird.flight.v + GRAVITY * dt) };
}

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let next = rng;
  let center = 50;
  const course: Gate[] = [];
  for (let i = 0; i < 24; i++) {
    if (i > 0) {
      let change: number;
      [change, next] = nextInt(next, -12, 12);
      center = Math.max(30, Math.min(70, center + change));
    }
    course.push({ x: 125 + i * 58, center });
  }
  return [
    {
      birds: ids.map((id) => ({
        id,
        flight: { at: 0, y: 50, v: -18 },
        died: null,
        passed: 0,
        lastFlap: -COOLDOWN_MS,
      })),
      course,
      checked: 0,
    },
    next,
  ];
}

export const aliveCount = (world: World): number =>
  world.birds.filter((b) => b.died === null).length;
export const finished = (world: World): boolean => world.birds.length > 1 && aliveCount(world) <= 1;

function collides(world: World, bird: Bird, t: number): boolean {
  const { y } = birdPosition(bird, t);
  if (y - R <= 0 || y + R >= H) return true;
  const distance = (SPEED * t) / 1000;
  return world.course.some((g) => {
    const gx = g.x - distance;
    return (
      gx <= X + R &&
      gx + GATE_WIDTH >= X - R &&
      (y - R <= g.center - GAP / 2 || y + R >= g.center + GAP / 2)
    );
  });
}

/** Judge all birds together before checking for a survivor: array order cannot break a tie. */
export function tick(world: World, to: number): World {
  const last = Math.min(ROUND_MS, Math.floor(to / STEP_MS) * STEP_MS);
  if (last <= world.checked || finished(world)) return world;
  let birds = world.birds;
  let checked = world.checked;
  for (let t = world.checked + STEP_MS; t <= last; t += STEP_MS) {
    const distance = (SPEED * t) / 1000;
    birds = birds.map((b) => {
      if (b.died !== null) return b;
      if (collides(world, b, t)) return { ...b, died: t };
      const passed = world.course.filter((g) => g.x + GATE_WIDTH - distance < X - R).length;
      return passed === b.passed ? b : { ...b, passed };
    });
    checked = t;
    if (birds.length > 1 && birds.filter((b) => b.died === null).length <= 1) break;
  }
  return { ...world, birds, checked };
}

export function applyFlap(world: World, id: string, t: number): World {
  const bird = world.birds.find((b) => b.id === id);
  if (
    !bird ||
    bird.died !== null ||
    t < world.checked ||
    t - bird.lastFlap < COOLDOWN_MS ||
    t < bird.flight.at
  )
    return world;
  // Inputs between grid samples must not rescue an already overlapping glider.
  if (collides(world, bird, t))
    return { ...world, birds: world.birds.map((b) => (b === bird ? { ...b, died: t } : b)) };
  const next = { ...bird, flight: { at: t, y: birdPosition(bird, t).y, v: FLAP_V }, lastFlap: t };
  return { ...world, birds: world.birds.map((b) => (b === bird ? next : b)) };
}

/** Future obstacles beyond the screen are hidden from humans and bot decisions alike. */
export function visibleGates(world: World): Gate[] {
  const distance = (SPEED * world.checked) / 1000;
  return world.course.filter((g) => g.x - distance <= W && g.x + GATE_WIDTH - distance >= 0);
}
