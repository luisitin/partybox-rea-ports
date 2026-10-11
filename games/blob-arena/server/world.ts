// Fixed-grid physics, including eating, replenishment and respawns. No engine clocks here.
import type { RngState } from '@partybox/game-sdk';
import { makePellet } from './content';
import { resolveCells } from './collisions';
import { clampCell, distance, radius, round, speed } from './geometry';
import { spawnCell } from './spawn';
import {
  MAX_CELLS,
  MERGE_MS,
  PELLET_MASS,
  RESPAWN_MS,
  SPLIT_COOLDOWN_MS,
  SPLIT_MIN,
  STEP_MS,
} from './types';
import type { Input, World } from './types';

export function apply(world: World, id: string, input: Input, time: number): World {
  const control = Object.hasOwn(world.controls, id) ? world.controls[id] : undefined;
  if (!control || time < world.time || time < control.at) return world;
  if (time < control.at + 50 && !(input.type === 'steer' && input.x === 0 && input.y === 0))
    return world;
  if (input.type === 'steer') {
    const length = Math.max(1, Math.hypot(input.x, input.y));
    const x = round(input.x / length),
      y = round(input.y / length);
    if (control.x === x && control.y === y) return world;
    return { ...world, controls: { ...world.controls, [id]: { ...control, x, y, at: time } } };
  }
  if (time - control.splitAt < SPLIT_COOLDOWN_MS || Math.hypot(control.x, control.y) < 0.1)
    return world;
  const owned = world.cells.filter((c) => c.owner === id);
  let slots = MAX_CELLS - owned.length;
  if (slots <= 0 || !owned.some((c) => c.mass >= SPLIT_MIN && time >= c.shieldUntil)) return world;
  let serial = world.serial;
  const norm = Math.hypot(control.x, control.y);
  const dx = control.x / norm,
    dy = control.y / norm;
  const cells = world.cells.flatMap((c) => {
    if (c.owner !== id || slots <= 0 || c.mass < SPLIT_MIN || time < c.shieldUntil) return [c];
    slots--;
    const half = c.mass / 2;
    const origin = { ...c, mass: half, mergeAt: time + MERGE_MS };
    const child = clampCell({
      ...origin,
      id: serial++,
      x: c.x + dx * radius(half) * 2,
      y: c.y + dy * radius(half) * 2,
      vx: dx * 55,
      vy: dy * 55,
    });
    return [origin, child];
  });
  return {
    ...world,
    cells,
    serial,
    controls: { ...world.controls, [id]: { ...control, splitAt: time, at: time } },
  };
}

export function tick(
  start: World,
  rng: RngState,
  to: number,
  left: readonly string[] = [],
): [World, RngState] {
  const end = Math.max(start.time, Math.floor(to / STEP_MS) * STEP_MS);
  if (end === start.time) return [start, rng];
  let world = start;
  let r = rng;
  while (world.time < end) {
    const time = world.time + STEP_MS;
    let cells = world.cells.map((c) => {
      const control = world.controls[c.owner];
      const dx = control?.x ?? 0,
        dy = control?.y ?? 0;
      const sx = dx * speed(c.mass),
        sy = dy * speed(c.mass);
      const siblings = world.cells.filter((o) => o.owner === c.owner && o.id !== c.id);
      const gather =
        time >= c.mergeAt && siblings.every((o) => time >= o.mergeAt) && siblings.length > 0;
      const center = gather
        ? {
            x: siblings.reduce((n, o) => n + o.x, 0) / siblings.length,
            y: siblings.reduce((n, o) => n + o.y, 0) / siblings.length,
          }
        : c;
      const gap = Math.max(1, distance(c, center));
      const gx = gather ? ((center.x - c.x) / gap) * 8 : 0;
      const gy = gather ? ((center.y - c.y) / gap) * 8 : 0;
      return clampCell({
        ...c,
        x: c.x + ((sx + c.vx + gx) * STEP_MS) / 1000,
        y: c.y + ((sy + c.vy + gy) * STEP_MS) / 1000,
        vx: round(c.vx * 0.78),
        vy: round(c.vy * 0.78),
      });
    });
    // A fixed pellet array bounds both state size and update cost.
    const pellets = world.pellets.map((p) => {
      const eater = cells.find((c) => distance(c, p) <= radius(c.mass));
      if (!eater) return p;
      eater.mass += PELLET_MASS;
      const [fresh, next] = makePellet(r, p.id);
      r = next;
      return fresh;
    });
    cells = resolveCells(cells, time);
    const respawns = { ...world.respawns };
    const controls = { ...world.controls };
    world = { ...world, time, cells, pellets, respawns, controls };
    for (const id of Object.keys(controls)) {
      if (left.includes(id) || cells.some((c) => c.owner === id)) continue;
      if (!Object.hasOwn(respawns, id)) {
        respawns[id] = time + RESPAWN_MS;
        controls[id] = { ...controls[id]!, x: 0, y: 0 };
      }
      if (time >= respawns[id]!) {
        const [cell, next] = spawnCell(world, id, r);
        r = next;
        cells.push(cell);
        world.serial++;
        delete respawns[id];
      }
    }
    // The growth happened after movement; put enlarged cells back inside the wall.
    world = { ...world, cells: cells.map(clampCell) };
  }
  return [world, r];
}

export function totalMass(world: World, id: string): number {
  return world.cells.filter((c) => c.owner === id).reduce((sum, c) => sum + c.mass, 0);
}
