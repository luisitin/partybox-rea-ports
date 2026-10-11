// Fixed-step city simulation. Clones once per event, then mutates only the fresh local copies.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { DISTRICT_PROPS, PROP_RULES } from './content';
import { HEIGHT, IMMUNE_MS, RECYCLE_MS, RESPAWN_MS, ROUND_MS, STEP_MS, WIDTH } from './types';
import type { CityProp, Hole, Input, World } from './types';

const CELL = 15;
const round = (n: number): number => Math.round(n * 10_000) / 10_000 || 0;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
export const radiusOf = (mass: number): number => Math.min(14, 3.4 + Math.sqrt(mass) * 0.6);
export const speedOf = (mass: number): number => Math.max(11, 19 - Math.sqrt(mass) * 0.35);
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
      // Small objects ring each start; buildings occupy the outer corners.
      const angle = ((i % 12) * Math.PI) / 6;
      const reach = i < 12 ? 8 + Math.floor(i / 4) * 3 : 17;
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
    score: 0,
    swallowed: 0,
    respawnAt: null,
    immuneUntil: IMMUNE_MS,
    lastGain: 0,
    gainAt: -2000,
    inputAt: -1,
  }));
  return [{ holes, props, cells: indexProps(props), elapsed: 0 }, r];
}

export function applyMove(world: World, id: string, input: Input): World {
  const hole = world.holes.find((h) => h.id === id);
  if (!hole || hole.respawnAt !== null) return world;
  const norm = Math.max(1, Math.hypot(input.x, input.y));
  const dx = round(input.x / norm),
    dy = round(input.y / norm);
  if (hole.dx === dx && hole.dy === dy && hole.inputAt === world.elapsed) return world;
  return {
    ...world,
    holes: world.holes.map((h) => (h.id === id ? { ...h, dx, dy, inputAt: world.elapsed } : h)),
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
  // If two holes cover an object on the same tick, nearest centre wins; equal distance rotates
  // by object id and tick so the lowest seat never has a permanent collision advantage.
  const claims = new Map<number, { hole: Hole; distance: number; priority: number }>();
  for (const h of world.holes) {
    if (h.respawnAt !== null) continue;
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
          const priority = (h.slot + p.id + at / STEP_MS) % world.holes.length;
          const prev = claims.get(i);
          if (
            !prev ||
            distance < prev.distance ||
            (distance === prev.distance && priority < prev.priority)
          )
            claims.set(i, { hole: h, distance, priority });
        }
      }
  }
  for (const [i, claim] of claims) {
    const p = world.props[i]!;
    gain(claim.hole, p.points, at);
    world.props[i] = { ...p, availableAt: p.radius <= 2.6 ? at + RECYCLE_MS : ROUND_MS + 1 };
  }
}

function consumeHoles(world: World, at: number): void {
  // Resolve largest first. A hole eaten this tick cannot also eat a smaller hole.
  const ordered = [...world.holes].sort((a, b) => b.mass - a.mass || a.slot - b.slot);
  for (const big of ordered) {
    if (big.respawnAt !== null || big.immuneUntil > at) continue;
    for (const small of ordered) {
      if (small === big || small.respawnAt !== null || small.immuneUntil > at) continue;
      const br = radiusOf(big.mass),
        sr = radiusOf(small.mass);
      if (br < sr * 1.25 || Math.hypot(big.x - small.x, big.y - small.y) > br - sr * 0.35) continue;
      gain(big, 10 + Math.floor(small.mass / 2), at);
      big.swallowed++;
      small.mass = 0;
      small.dx = 0;
      small.dy = 0;
      small.respawnAt = at + RESPAWN_MS;
    }
  }
}

function respawn(h: Hole, holes: Hole[], at: number): void {
  // Pick the district farthest from active rivals; tie uses the player's slot.
  let best = spawnOf(h.slot),
    clearance = -1;
  for (let i = 0; i < 8; i++) {
    const p = spawnOf((i + h.slot) % 8);
    const gap = Math.min(
      WIDTH,
      ...holes
        .filter((o) => o !== h && o.respawnAt === null)
        .map((o) => Math.hypot(o.x - p.x, o.y - p.y) - radiusOf(o.mass)),
    );
    if (gap > clearance) {
      best = p;
      clearance = gap;
    }
  }
  h.x = best.x;
  h.y = best.y;
  h.respawnAt = null;
  h.immuneUntil = at + IMMUNE_MS;
}

export function tick(world: World, to: number): World {
  const end = Math.floor(clamp(to, 0, ROUND_MS) / STEP_MS) * STEP_MS;
  if (end <= world.elapsed) return world;
  const next: World = {
    ...world,
    holes: world.holes.map((h) => ({ ...h })),
    props: [...world.props],
  };
  for (let at = world.elapsed + STEP_MS; at <= end; at += STEP_MS) {
    for (const h of next.holes) {
      if (h.respawnAt !== null) {
        if (h.respawnAt <= at) respawn(h, next.holes, at);
        else continue;
      }
      const radius = radiusOf(h.mass),
        distance = (speedOf(h.mass) * STEP_MS) / 1000;
      h.x = round(clamp(h.x + h.dx * distance, radius, WIDTH - radius));
      h.y = round(clamp(h.y + h.dy * distance, radius, HEIGHT - radius));
    }
    consumeProps(next, at);
    consumeHoles(next, at);
  }
  return { ...next, elapsed: end };
}
