// Fixed-step simultaneous arena, bounded bodies and edible wreckage. Self-crossing is safe.
import type { RngState } from '@partybox/game-sdk';
import { spark } from './content';
import { angleDelta, distance2, rounded, segmentDistance2 } from './geometry';
import {
  BOOST_COST,
  BOOST_SPEED,
  FOOD_COUNT,
  GRACE_MS,
  H,
  MAX_FOOD,
  MAX_MASS,
  MIN_MASS,
  RADIUS,
  RESPAWN_MS,
  SPEED,
  START_MASS,
  STEP_MS,
  TURN_RATE,
  W,
} from './types';
import type { Food, Point, Snake, World } from './types';

export function spawn(
  id: string,
  slot: number,
  count: number,
  elapsed: number,
  crashes = 0,
): Snake {
  const th = (slot * 2 * Math.PI) / Math.max(1, count) + crashes * 0.73;
  const head: Point = [rounded(W / 2 + 50 * Math.cos(th)), rounded(H / 2 + 28 * Math.sin(th))];
  const angle = Math.atan2(28 * Math.cos(th), -50 * Math.sin(th));
  return {
    id,
    body: Array.from({ length: START_MASS }, (_, i): Point => [
      rounded(head[0] - Math.cos(angle) * i * 1.6),
      rounded(head[1] - Math.sin(angle) * i * 1.6),
    ]),
    angle,
    target: angle,
    boost: false,
    mass: START_MASS,
    respawnAt: null,
    safeUntil: elapsed + GRACE_MS,
    crashes,
  };
}

export function makeWorld(ids: string[], rng: RngState): [World, RngState] {
  const food: Food[] = [];
  let r = rng;
  for (let i = 0; i < FOOD_COUNT; i++) {
    const [f, next] = spark(r);
    food.push(f);
    r = next;
  }
  return [{ snakes: ids.map((id, i) => spawn(id, i, ids.length, 0)), food, elapsed: 0 }, r];
}

export function move(snake: Snake): Snake {
  const turn = Math.max(
    (-TURN_RATE * STEP_MS) / 1000,
    Math.min((TURN_RATE * STEP_MS) / 1000, angleDelta(snake.angle, snake.target)),
  );
  const angle = Math.atan2(Math.sin(snake.angle + turn), Math.cos(snake.angle + turn));
  const boosting = snake.boost && snake.mass > MIN_MASS;
  const mass = boosting ? rounded(Math.max(MIN_MASS, snake.mass - BOOST_COST)) : snake.mass;
  const speed = boosting ? BOOST_SPEED : SPEED;
  const head = snake.body[0]!;
  const next: Point = [
    rounded(head[0] + (Math.cos(angle) * speed * STEP_MS) / 1000),
    rounded(head[1] + (Math.sin(angle) * speed * STEP_MS) / 1000),
  ];
  return { ...snake, angle, mass, body: [next, ...snake.body].slice(0, Math.ceil(mass)) };
}

interface Segment {
  owner: number;
  a: Point;
  b: Point;
}
const CELL = 8;
const key = (x: number, y: number): number => x * 512 + y;

function bodyGrid(snakes: Snake[], elapsed: number): Map<number, Segment[]> {
  const grid = new Map<number, Segment[]>();
  snakes.forEach((s, owner) => {
    if (s.respawnAt !== null || elapsed < s.safeUntil) return;
    for (let i = 1; i < s.body.length; i++) {
      const a = s.body[i - 1]!,
        b = s.body[i]!;
      const seg = { owner, a, b };
      for (
        let x = Math.floor(Math.min(a[0], b[0]) / CELL);
        x <= Math.floor(Math.max(a[0], b[0]) / CELL);
        x++
      )
        for (
          let y = Math.floor(Math.min(a[1], b[1]) / CELL);
          y <= Math.floor(Math.max(a[1], b[1]) / CELL);
          y++
        ) {
          const k = key(x, y),
            bucket = grid.get(k);
          if (bucket) bucket.push(seg);
          else grid.set(k, [seg]);
        }
    }
  });
  return grid;
}

function step(world: World, rng: RngState, connected: Record<string, boolean>): [World, RngState] {
  const elapsed = world.elapsed + STEP_MS;
  const old = world.snakes.map((s, i) =>
    s.respawnAt !== null && s.respawnAt <= elapsed && connected[s.id] !== false
      ? spawn(s.id, i, world.snakes.length, elapsed, s.crashes)
      : s,
  );
  const moved = old.map((s) => (s.respawnAt === null ? move(s) : s));
  const grid = bodyGrid(old, elapsed);
  const dead = new Set<number>();
  moved.forEach((s, i) => {
    if (s.respawnAt !== null) return;
    const h = s.body[0]!,
      from = old[i]!.body[0]!;
    if (h[0] < RADIUS || h[0] > W - RADIUS || h[1] < RADIUS || h[1] > H - RADIUS) {
      dead.add(i);
      return;
    }
    if (elapsed < s.safeUntil) return;
    const cx = Math.floor(h[0] / CELL),
      cy = Math.floor(h[1] / CELL);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        for (const seg of grid.get(key(cx + dx, cy + dy)) ?? []) {
          if (seg.owner !== i && segmentDistance2(from, h, seg.a, seg.b) <= (RADIUS * 2) ** 2)
            dead.add(i);
        }
      }
    moved.forEach((other, j) => {
      if (j <= i || other.respawnAt !== null || elapsed < other.safeUntil) return;
      // Relative head motion catches crossing trajectories, without size or seat-order advantage.
      const p: Point = [from[0] - old[j]!.body[0]![0], from[1] - old[j]!.body[0]![1]];
      const q: Point = [h[0] - other.body[0]![0], h[1] - other.body[0]![1]];
      if (segmentDistance2(p, q, [0, 0], [0, 0]) <= (RADIUS * 2) ** 2) {
        dead.add(i);
        dead.add(j);
      }
    });
  });
  const extra: Food[] = [];
  const snakes = moved.map((s, i) => {
    if (dead.has(i)) {
      const corpse = s.body.filter((_, j) => j % 2 === 0);
      for (const p of corpse)
        extra.push({
          x: Math.max(2, Math.min(W - 2, p[0])),
          y: Math.max(2, Math.min(H - 2, p[1])),
          value: rounded(s.mass / corpse.length),
        });
      return {
        ...s,
        body: [],
        mass: MIN_MASS,
        boost: false,
        respawnAt: elapsed + RESPAWN_MS,
        crashes: s.crashes + 1,
      };
    }
    if (old[i]!.boost && old[i]!.mass > MIN_MASS && s.respawnAt === null) {
      const tail = old[i]!.body.at(-1)!;
      extra.push({ x: tail[0], y: tail[1], value: rounded(old[i]!.mass - s.mass) });
    }
    return s;
  });
  const food: Food[] = [];
  for (const f of world.food) {
    let nearest = Infinity;
    let eaters: number[] = [];
    snakes.forEach((s, i) => {
      if (s.respawnAt !== null) return;
      const d = distance2(s.body[0]!, [f.x, f.y]);
      if (d > (RADIUS + 1.2) ** 2) return;
      if (d < nearest - 0.000001) {
        nearest = d;
        eaters = [i];
      } else if (Math.abs(d - nearest) < 0.000001) eaters.push(i);
    });
    if (eaters.length === 0) food.push(f);
    else
      for (const i of eaters) {
        const s = snakes[i]!;
        snakes[i] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value / eaters.length)) };
      }
  }
  food.push(...extra);
  let r = rng;
  while (food.length < FOOD_COUNT) {
    const [f, next] = spark(r);
    food.push(f);
    r = next;
  }
  return [{ snakes, food: food.slice(-MAX_FOOD), elapsed }, r];
}

export function tick(
  world: World,
  rng: RngState,
  to: number,
  connected: Record<string, boolean>,
): [World, RngState] {
  let w = world,
    r = rng;
  const end = Math.floor(to / STEP_MS) * STEP_MS;
  while (w.elapsed < end) [w, r] = step(w, r, connected);
  return [w, r];
}
