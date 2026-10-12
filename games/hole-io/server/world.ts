// Fixed-step city simulation. Clones once per event, then mutates only the fresh local copies.
import { compareCodeUnits, nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { DISTRICT_PROPS, PROP_RULES } from './content';
import {
  HEIGHT,
  IMMUNE_MS,
  MAX_SINKS,
  RECYCLE_MS,
  ROUND_MS,
  SINK_MS,
  STEP_MS,
  WIDTH,
} from './types';
import type { CityProp, Hole, Input, World } from './types';

const CELL = 15;
const round = (n: number): number => Math.round(n * 10_000) / 10_000 || 0;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
// One historical table informs this port's discrete tuning; it is not a verified
// current-native formula. A single small prop cannot bypass an entire tier.
export const GROWTH_THRESHOLDS = [0, 10, 27, 51, 82, 120, 165, 217, 246] as const;
export const LEVEL_RADII = [2.2, 3.3, 4.8, 6.2, 7.8, 9.2, 10.8, 12.4, 14] as const;
export function levelOf(mass: number): number {
  let level = 1;
  for (let i = 1; i < GROWTH_THRESHOLDS.length; i++)
    if (mass >= GROWTH_THRESHOLDS[i]!) level = i + 1;
  return level;
}
export function growthOf(mass: number): {
  level: number;
  levelProgress: number;
  nextLevelAt: number | null;
} {
  const level = levelOf(mass);
  const lower = GROWTH_THRESHOLDS[level - 1]!;
  const nextLevelAt = GROWTH_THRESHOLDS[level] ?? null;
  return {
    level,
    levelProgress: nextLevelAt === null ? 1 : clamp((mass - lower) / (nextLevelAt - lower), 0, 1),
    nextLevelAt,
  };
}
export const radiusOf = (mass: number): number => LEVEL_RADII[levelOf(mass) - 1]!;
export const speedOf = (mass: number): number => Math.max(11, 19 - (levelOf(mass) - 1) * 0.7);
/** Old inactive snapshots never regain participation through a retired respawn clock. */
export const isAlive = (hole: Hole): boolean => hole.alive !== false && hole.respawnAt === null;
export const spawnOf = (slot: number): { x: number; y: number } => ({
  x: 22.5 + (slot % 4) * 45,
  y: 27.5 + Math.floor(slot / 4) * 55,
});

export function indexProps(props: CityProp[]): Record<string, number[]> {
  const cells: Record<string, number[]> = {};
  props.forEach((p, i) => {
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
    (cells[key] ??= []).push(i);
  });
  return cells;
}

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let r = rng;
  // All eight districts have the same resources. Seed changes their layout, never their budget.
  const props: CityProp[] = [];
  for (let slot = 0; slot < 8; slot++) {
    const origin = spawnOf(slot);
    for (let i = 0; i < DISTRICT_PROPS.length; i++) {
      const kind = DISTRICT_PROPS[i]!;
      const rule = PROP_RULES[kind];
      let jitterX: number, jitterY: number;
      [jitterX, r] = nextInt(r, -15, 15);
      [jitterY, r] = nextInt(r, -15, 15);
      // Staggered concentric streets keep early food close and large props farther out.
      const angle = (i * Math.PI * (3 - Math.sqrt(5))) % (Math.PI * 2);
      const reach =
        kind === 'bin'
          ? 7 + (i % 3) * 3
          : kind === 'tree'
            ? 10 + (i % 3) * 3
            : kind === 'bench'
              ? 13 + (i % 3) * 3
              : kind === 'car'
                ? 15 + (i % 3) * 3
                : 19 + (i % 2) * 3;
      props.push({
        id: props.length,
        kind,
        radius: rule.radius,
        points: rule.points,
        x: round(
          clamp(
            origin.x + Math.cos(angle) * reach + jitterX / 10,
            rule.radius,
            WIDTH - rule.radius,
          ),
        ),
        y: round(
          clamp(
            origin.y + Math.sin(angle) * reach + jitterY / 10,
            rule.radius,
            HEIGHT - rule.radius,
          ),
        ),
        availableAt: 0,
      });
    }
  }
  const slots = [0, 2, 5, 7, 1, 3, 4, 6];
  let offset: number;
  [offset, r] = nextInt(r, 0, 7);
  const holes: Hole[] = ids.map((id, i) => ({
    id,
    slot: i,
    ...spawnOf(slots[(i + offset) % 8]!),
    dx: 0,
    dy: 0,
    mass: 0,
    alive: true,
    eliminatedAt: null,
    eliminatedBy: null,
    score: 0,
    swallowed: 0,
    respawnAt: null,
    immuneUntil: IMMUNE_MS,
    lastGain: 0,
    gainAt: -2000,
    inputAt: -1,
    lastMoveAt: -1,
  }));
  return [{ holes, props, cells: indexProps(props), elapsed: 0, sinks: [] }, r];
}

export function applyMove(world: World, id: string, input: Input, at = world.elapsed): World {
  const hole = world.holes.find((h) => h.id === id);
  if (!hole || !isAlive(hole) || at < (hole.lastMoveAt ?? -1)) return world;
  const norm = Math.max(1, Math.hypot(input.x, input.y));
  const dx = round(input.x / norm),
    dy = round(input.y / norm);
  if (hole.dx === dx && hole.dy === dy && hole.inputAt === world.elapsed && hole.lastMoveAt === at)
    return world;
  return {
    ...world,
    holes: world.holes.map((h) =>
      h.id === id ? { ...h, dx, dy, inputAt: world.elapsed, lastMoveAt: at } : h,
    ),
  };
}

export function stopAll(world: World): World {
  return { ...world, holes: world.holes.map((h) => ({ ...h, dx: 0, dy: 0 })) };
}

function gain(hole: Hole, points: number, at: number): void {
  hole.mass += points;
  hole.score += points;
  const radius = radiusOf(hole.mass);
  hole.x = round(clamp(hole.x, radius, WIDTH - radius));
  hole.y = round(clamp(hole.y, radius, HEIGHT - radius));
  hole.lastGain = points;
  hole.gainAt = at;
}

function consumeProps(world: World, at: number): void {
  // Closest center wins. Exact ties rotate among the actual alive contenders,
  // so gaps in eliminated seat numbers never give a surviving seat an advantage.
  const claims = new Map<number, { holes: Hole[]; distance: number }>();
  for (const h of world.holes) {
    if (!isAlive(h)) continue;
    const radius = radiusOf(h.mass);
    const cx = Math.floor(h.x / CELL),
      cy = Math.floor(h.y / CELL);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        for (const i of world.cells[`${cx + ox},${cy + oy}`] ?? []) {
          const p = world.props[i]!;
          if (p.availableAt > at || p.radius >= radius) continue;
          const distance = (h.x - p.x) ** 2 + (h.y - p.y) ** 2;
          if (distance > (radius - p.radius * 0.5) ** 2) continue;
          const prev = claims.get(i);
          if (!prev || distance < prev.distance) claims.set(i, { holes: [h], distance });
          else if (distance === prev.distance) prev.holes.push(h);
        }
      }
  }
  for (const [i, claim] of claims) {
    const p = world.props[i]!;
    const contenders = claim.holes.sort((a, b) => a.slot - b.slot || compareCodeUnits(a.id, b.id));
    const winner = contenders[(p.id + at / STEP_MS) % contenders.length]!;
    gain(winner, p.points, at);
    const { availableAt: _available, ...publicProp } = p;
    world.sinks.push({ ...publicProp, by: winner.id, consumedAt: at });
    world.props[i] = { ...p, availableAt: p.radius <= 2.6 ? at + RECYCLE_MS : ROUND_MS + 1 };
  }
  world.sinks = world.sinks.slice(-MAX_SINKS);
}

function consumeHoles(world: World, at: number): void {
  // Resolve largest first. A hole eaten this tick cannot also eat a smaller hole.
  const ordered = [...world.holes].sort((a, b) => b.mass - a.mass || a.slot - b.slot);
  for (const big of ordered) {
    if (!isAlive(big) || big.immuneUntil > at) continue;
    for (const small of ordered) {
      if (small === big || !isAlive(small) || small.immuneUntil > at) continue;
      const br = radiusOf(big.mass),
        sr = radiusOf(small.mass);
      if (br < sr * 1.25 || Math.hypot(big.x - small.x, big.y - small.y) > br - sr * 0.35) continue;
      gain(big, 10 + Math.floor(small.mass / 2), at);
      big.swallowed++;
      small.alive = false;
      small.eliminatedAt = at;
      small.eliminatedBy = big.id;
      small.dx = 0;
      small.dy = 0;
    }
  }
}

export function tick(world: World, to: number): World {
  const end = Math.floor(clamp(to, 0, ROUND_MS) / STEP_MS) * STEP_MS;
  if (end <= world.elapsed) return world;
  const next: World = {
    ...world,
    holes: world.holes.map((h) => ({ ...h })),
    props: [...world.props],
    sinks: [...(world.sinks ?? [])],
  };
  for (let at = world.elapsed + STEP_MS; at <= end; at += STEP_MS) {
    for (const h of next.holes) {
      if (!isAlive(h)) continue;
      const radius = radiusOf(h.mass),
        distance = (speedOf(h.mass) * STEP_MS) / 1000;
      h.x = round(clamp(h.x + h.dx * distance, radius, WIDTH - radius));
      h.y = round(clamp(h.y + h.dy * distance, radius, HEIGHT - radius));
    }
    next.sinks = next.sinks.filter((sink) => at - sink.consumedAt < SINK_MS);
    consumeProps(next, at);
    consumeHoles(next, at);
  }
  return { ...next, elapsed: end };
}
