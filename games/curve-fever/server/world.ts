// The world of one Curve Fever round: every player steers a worm that never stops, leaves a trail (with a gap now and then) and dies
// on a wall or on any trail. Between steering changes a worm moves in a closed form (a straight line or a circle arc), so a view can
// draw it at any time; collisions are judged on a fixed 40 ms grid of samples (`tick`), so the same events give the same round.
// A pure function of the input list: nothing here reads a clock.
import { nextInt, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';

/** The arena is W x H units; a worm moves SPEED units a second and turns OMEGA radians a second while a button is held. */
export const W = 160;
export const H = 100;
export const SPEED = 12;
export const OMEGA = 2;
/** Judging grid (ms): a worm is sampled at every multiple of this, a trail is the solid samples. */
export const STEP_MS = 40;
/** A head within this distance of a solid trail sample (or another head) is dead; a wall kills within WALL. */
export const COLLIDE = 1.2;
export const WALL = 0.6;
/** A worm cannot hit its own last SELF_SAFE samples (the trail it has just laid under its own head). */
export const SELF_SAFE = 14;
/** A worm takes at most this many steering changes a round (keeps the state small). */
export const MAX_SEGS = 400;
/** The deadline re-arms at least this often (ms). */
export const TICK_MS = 200;
/** A round lasts at most this long (ms) once the worms are let go. */
export const ROUND_MS = 45_000;
/** The first second gives players room to find their heading; walls still kill. */
export const SPAWN_SAFE_MS = 1000;

/** One steering change: `[t (ms after the round began), x, y, heading (rad), turn (-1 left, 0 straight, 1 right)]`. */
export type Seg = [number, number, number, number, number];
/** `segs`: the steering history; `gaps`: flat [start, end, start, end, …] in ms (no trail inside); `died`: ms or null. */
export interface Worm {
  id: string;
  segs: Seg[];
  gaps: number[];
  died: number | null;
}
/** `stepped`: the last judged sample (index); everything up to `stepped * STEP_MS` has been decided. */
export interface World {
  worms: Worm[];
  stepped: number;
  safeUntil?: number;
}

export const inputSchema = z.object({
  type: z.literal('steer'),
  dir: z.number().int().min(-1).max(1),
});
export type Input = z.infer<typeof inputSchema>;

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Where a worm is at `t` (ms) if it has been in `seg` since `seg[0]`. */
export function segPos(seg: Seg, t: number): { x: number; y: number; a: number } {
  const [t0, x0, y0, a0, turn] = seg;
  const dt = Math.max(0, t - t0) / 1000;
  if (turn === 0)
    return { x: x0 + Math.cos(a0) * SPEED * dt, y: y0 + Math.sin(a0) * SPEED * dt, a: a0 };
  const w = turn * OMEGA;
  const a = a0 + w * dt;
  return {
    x: x0 + (SPEED / w) * (Math.sin(a) - Math.sin(a0)),
    y: y0 - (SPEED / w) * (Math.cos(a) - Math.cos(a0)),
    a,
  };
}

/** The segment a worm is in at `t`. */
export function segAt(worm: Worm, t: number): Seg {
  let lo = 0;
  let hi = worm.segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((worm.segs[mid]?.[0] ?? 0) <= t) lo = mid;
    else hi = mid - 1;
  }
  return worm.segs[lo] as Seg;
}

export function posAt(worm: Worm, t: number): { x: number; y: number; a: number } {
  return segPos(segAt(worm, t), t);
}

/** Whether `t` falls inside one of the worm's gaps (no trail laid). */
export function inGap(worm: Worm, t: number): boolean {
  for (let i = 0; i + 1 < worm.gaps.length; i += 2) {
    if (t >= (worm.gaps[i] ?? 0) && t < (worm.gaps[i + 1] ?? 0)) return true;
  }
  return false;
}

export const aliveCount = (world: World): number =>
  world.worms.filter((w) => w.died === null).length;

/** The round is over when one worm is left (or none); a lone player's round just runs to its cap. */
export const finished = (world: World): boolean =>
  world.worms.length > 1 ? aliveCount(world) <= 1 : false;

/** Shuffled ring slots with a shared tangent direction, so starts do not converge on the centre. */
export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let r = rng;
  const n = ids.length;
  const slots = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    let j: number;
    [j, r] = nextInt(r, 0, i);
    const a = slots[i] ?? 0;
    slots[i] = slots[j] ?? 0;
    slots[j] = a;
  }
  const [offset, afterOffset] = nextInt(r, 0, 628);
  r = afterOffset;
  const [clockwise, afterDirection] = nextInt(r, 0, 1);
  r = afterDirection;
  const worms: Worm[] = [];
  for (let i = 0; i < n; i++) {
    let jx: number, jy: number, ja: number;
    [jx, r] = nextInt(r, -20, 20);
    [jy, r] = nextInt(r, -20, 20);
    [ja, r] = nextInt(r, -8, 8);
    const th = (2 * Math.PI * (slots[i] ?? 0)) / Math.max(1, n) + offset / 100;
    const x = W / 2 + 52 * Math.cos(th) + jx / 10;
    const y = H / 2 + 28 * Math.sin(th) + jy / 10;
    const tangent = Math.atan2(28 * Math.cos(th), -52 * Math.sin(th)) + clockwise * Math.PI;
    const gaps: number[] = [];
    let t: number;
    [t, r] = nextInt(r, 2000, 4500);
    while (t < ROUND_MS + 1000) {
      let len: number, rest: number;
      [len, r] = nextInt(r, 240, 340);
      [rest, r] = nextInt(r, 2000, 4200);
      gaps.push(t, t + len);
      t += len + rest;
    }
    worms.push({
      id: ids[i] as string,
      segs: [[0, round3(x), round3(y), round3(tangent + ja / 100), 0]],
      gaps,
      died: null,
    });
  }
  return [{ worms, stepped: -1, safeUntil: SPAWN_SAFE_MS }, r];
}

const CELL = 2;
const bucketKey = (cx: number, cy: number): number => cx * 4096 + cy;

interface Sample {
  w: number;
  k: number;
  x: number;
  y: number;
}

/** Judge every sample after `world.stepped` up to the one at `to` (ms): walls, trails, heads. A death is recorded at the sample's time. */
export function tick(world: World, to: number): World {
  const last = Math.floor(to / STEP_MS);
  if (last <= world.stepped || world.worms.length === 0) return world;
  const hash = new Map<number, Sample[]>();
  const lay = (s: Sample): void => {
    const key = bucketKey(Math.floor(s.x / CELL), Math.floor(s.y / CELL));
    const bucket = hash.get(key);
    if (bucket) bucket.push(s);
    else hash.set(key, [s]);
  };
  // The trails laid so far (a dead worm laid none from its death sample on).
  world.worms.forEach((worm, w) => {
    const end =
      worm.died === null ? world.stepped : Math.min(world.stepped, worm.died / STEP_MS - 1);
    let si = 0;
    for (let k = 0; k <= end; k++) {
      const t = k * STEP_MS;
      if (inGap(worm, t)) continue;
      while (si + 1 < worm.segs.length && (worm.segs[si + 1]?.[0] ?? Infinity) <= t) si++;
      const p = segPos(worm.segs[si] as Seg, t);
      lay({ w, k, x: p.x, y: p.y });
    }
  });
  const died = world.worms.map((worm) => worm.died);
  const segIdx = world.worms.map(() => 0);
  for (let k = world.stepped + 1; k <= last; k++) {
    const t = k * STEP_MS;
    const heads: { w: number; x: number; y: number; solid: boolean }[] = [];
    world.worms.forEach((worm, w) => {
      if (died[w] !== null) return;
      let si = segIdx[w] ?? 0;
      while (si + 1 < worm.segs.length && (worm.segs[si + 1]?.[0] ?? Infinity) <= t) si++;
      segIdx[w] = si;
      const p = segPos(worm.segs[si] as Seg, t);
      heads.push({ w, x: p.x, y: p.y, solid: !inGap(worm, t) });
    });
    const dead = new Set<number>();
    for (const h of heads) {
      if (h.x < WALL || h.x > W - WALL || h.y < WALL || h.y > H - WALL) {
        dead.add(h.w);
        continue;
      }
      if (t < (world.safeUntil ?? 0)) continue;
      const cx = Math.floor(h.x / CELL);
      const cy = Math.floor(h.y / CELL);
      let hit = false;
      for (let dx = -1; dx <= 1 && !hit; dx++) {
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (const s of hash.get(bucketKey(cx + dx, cy + dy)) ?? []) {
            if (s.w === h.w && k - s.k < SELF_SAFE) continue;
            if ((s.x - h.x) ** 2 + (s.y - h.y) ** 2 < COLLIDE * COLLIDE) {
              hit = true;
              break;
            }
          }
        }
      }
      if (!hit)
        hit = heads.some(
          (o) => o.w !== h.w && o.solid && (o.x - h.x) ** 2 + (o.y - h.y) ** 2 < COLLIDE * COLLIDE,
        );
      if (hit) dead.add(h.w);
    }
    for (const h of heads) {
      if (dead.has(h.w)) died[h.w] = t;
      else if (h.solid) lay({ w: h.w, k, x: h.x, y: h.y });
    }
  }
  const worms = world.worms.map((worm, w) =>
    died[w] === worm.died ? worm : { ...worm, died: died[w] ?? null },
  );
  return { ...world, worms, stepped: last };
}

/** A steering change at `t` (ms after the round began): the worm carries on from where it is, turning the new way. */
export function apply(world: World, id: string, input: Input, t: number): World {
  const w = world.worms.findIndex((x) => x.id === id);
  const worm = world.worms[w];
  if (!worm || worm.died !== null || t < 0) return world;
  const cur = worm.segs[worm.segs.length - 1] as Seg;
  if (cur[4] === input.dir || worm.segs.length >= MAX_SEGS || t < cur[0]) return world;
  const p = segPos(cur, t);
  const seg: Seg = [
    Math.round(t),
    round3(p.x),
    round3(p.y),
    Math.round(p.a * 10000) / 10000,
    input.dir,
  ];
  const next = { ...worm, segs: [...worm.segs, seg] };
  return { ...world, worms: world.worms.map((x, i) => (i === w ? next : x)) };
}
