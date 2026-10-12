// Fixed-grid physics, including eating, replenishment and respawns. No engine clocks here.
import { nextInt } from '@partybox/game-sdk';
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
  ROUND_MS,
  SPLIT_COOLDOWN_MS,
  SPLIT_MIN,
  STEP_MS,
} from './types';
import type { Cell, Input, World } from './types';

// Positions are rounded to four decimals; this absorbs their negligible distance noise.
const PELLET_TIE_TOLERANCE = 0.001;

/** Neutralize holds at their active event time, including a newer already-neutral release. */
export function release(world: World, id?: string, at?: number): World {
  const barrier =
    at !== undefined && Number.isFinite(at)
      ? Math.max(world.time, Math.min(ROUND_MS, Math.max(0, at)))
      : world.time;
  let changed = false;
  const controls = Object.fromEntries(
    Object.entries(world.controls).map(([owner, control]) => {
      if (id !== undefined && owner !== id) return [owner, control];
      const time = Math.max(control.at, barrier);
      if (control.x === 0 && control.y === 0 && time === control.at) return [owner, control];
      changed = true;
      return [owner, { ...control, x: 0, y: 0, at: time }];
    }),
  );
  return changed ? { ...world, controls } : world;
}

/** A permanent departure removes its pieces and pending return without losing banked points. */
export function retire(world: World, id: string, at?: number): World {
  const released = release(world, id, at);
  const cells = released.cells.filter((cell) => cell.owner !== id);
  const pending = Object.hasOwn(released.respawns, id);
  if (cells.length === released.cells.length && !pending) return released;
  const respawns = { ...released.respawns };
  delete respawns[id];
  return { ...released, cells, respawns };
}

export function apply(world: World, id: string, input: Input, time: number): World {
  const control = Object.hasOwn(world.controls, id) ? world.controls[id] : undefined;
  if (!control || time < world.time || time < control.at) return world;
  if (input.type === 'steer') {
    const length = Math.max(1, Math.hypot(input.x, input.y));
    const x = round(input.x / length),
      y = round(input.y / length);
    if (control.x === x && control.y === y && time === control.at) return world;
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
      let eater: Cell | undefined;
      let nearest = Infinity;
      let ties: { cell: Cell; gap: number }[] | undefined;
      for (const candidate of cells) {
        const square = (candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2;
        if (square > Math.min(24 ** 2, candidate.mass * 0.55 ** 2)) continue;
        const gap = Math.sqrt(square);
        if (gap < nearest) {
          const previous = eater;
          const previousGap = nearest;
          eater = candidate;
          nearest = gap;
          if (previous && previousGap - gap <= PELLET_TIE_TOLERANCE) {
            ties ??= [{ cell: previous, gap: previousGap }];
            ties.push({ cell: candidate, gap });
            // Compare to the actual minimum, avoiding a chain of progressively farther ties.
            ties = ties.filter((tie) => tie.gap - nearest <= PELLET_TIE_TOLERANCE);
          } else ties = undefined;
        } else if (gap - nearest <= PELLET_TIE_TOLERANCE) {
          ties ??= [{ cell: eater!, gap: nearest }];
          ties.push({ cell: candidate, gap });
        }
      }
      if (!eater) return p;
      if (ties && ties.length > 1) {
        ties.sort((a, b) => a.cell.id - b.cell.id);
        let chosen: number;
        [chosen, r] = nextInt(r, 0, ties.length - 1);
        eater = ties[chosen]!.cell;
      }
      eater.mass += PELLET_MASS;
      const [fresh, next] = makePellet(r, p.id);
      r = next;
      return fresh;
    });
    cells = resolveCells(cells, time, world.cells);
    const respawns = { ...world.respawns };
    const controls = { ...world.controls };
    world = { ...world, time, cells, pellets, respawns, controls };
    for (const id of Object.keys(controls)) {
      if (left.includes(id) || cells.some((c) => c.owner === id)) continue;
      if (!Object.hasOwn(respawns, id)) {
        respawns[id] = time + RESPAWN_MS;
        controls[id] = { ...controls[id]!, x: 0, y: 0, at: Math.max(time, controls[id]!.at) };
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
