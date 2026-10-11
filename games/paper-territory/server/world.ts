// Every tick proposes all heads from one snapshot. Cuts/head collisions precede closure.
// Captures use four-neighbour flood fill; same-tick contested cells become neutral.
import { z } from '@partybox/game-sdk';
import type { PlayerInfo } from '@partybox/game-sdk';
import { ANCHORS } from './content';
import { HEIGHT, RESPAWN_TICKS, WIDTH } from './types';
import type { Direction, Input, Runner, World } from './types';

export const inputSchema = z.object({
  type: z.literal('direction'),
  dir: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export function neighbour(cell: number, dir: Direction, width = WIDTH, height = HEIGHT): number {
  const x = cell % width,
    y = Math.floor(cell / width);
  if (
    (dir === 0 && y === 0) ||
    (dir === 1 && x === width - 1) ||
    (dir === 2 && y === height - 1) ||
    (dir === 3 && x === 0)
  )
    return -1;
  return cell + [-width, 1, width, -1][dir]!;
}
export function neighbours(cell: number, width: number, height: number): number[] {
  return ([0, 1, 2, 3] as Direction[])
    .map((dir) => neighbour(cell, dir, width, height))
    .filter((c) => c >= 0);
}
export function createWorld(players: readonly PlayerInfo[]): World {
  const owners = Array<number>(WIDTH * HEIGHT).fill(-1);
  const homes = Array<number>(WIDTH * HEIGHT).fill(-1);
  const runners = players.map((p, slot): Runner => {
    const [x, y] = ANCHORS[slot % ANCHORS.length]!;
    const home = y * WIDTH + x;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        owners[home + dy * WIDTH + dx] = homes[home + dy * WIDTH + dx] = slot;
    const dir: Direction = x < WIDTH / 2 ? 1 : 3;
    return {
      id: p.id,
      slot,
      home,
      cell: home,
      dir,
      queued: dir,
      trail: [],
      alive: p.connected,
      respawnTick: p.connected ? null : RESPAWN_TICKS,
      deaths: 0,
      area: 9,
      captures: 0,
      lastCapture: 0,
      cause: null,
    };
  });
  return { width: WIDTH, height: HEIGHT, owners, homes, runners, stepped: 0 };
}
export function applyDirection(world: World, id: string, input: Input): World {
  const runner = world.runners.find((r) => r.id === id);
  if (
    !runner?.alive ||
    input.type !== 'direction' ||
    !Number.isInteger(input.dir) ||
    input.dir < 0 ||
    input.dir > 3 ||
    input.dir === (runner.dir + 2) % 4 ||
    input.dir === runner.queued
  )
    return world;
  return {
    ...world,
    runners: world.runners.map((r) => (r.id === id ? { ...r, queued: input.dir } : r)),
  };
}
function countAreas(world: World): World {
  const counts = Array<number>(world.runners.length).fill(0);
  for (const owner of world.owners) if (owner >= 0) counts[owner] = (counts[owner] ?? 0) + 1;
  return { ...world, runners: world.runners.map((r) => ({ ...r, area: counts[r.slot] ?? 0 })) };
}
export function removeRunner(
  world: World,
  slot: number,
  cause: Runner['cause'],
  forever = false,
): World {
  const runner = world.runners.find((r) => r.slot === slot);
  if (!runner) return world;
  const owners = world.owners.map((owner, cell) =>
    owner === slot && world.homes[cell] !== slot ? -1 : owner,
  );
  return countAreas({
    ...world,
    owners,
    runners: world.runners.map((r) =>
      r.slot === slot
        ? {
            ...r,
            alive: false,
            trail: [],
            cause,
            deaths: r.deaths + (cause === 'connection' || !r.alive ? 0 : 1),
            respawnTick: forever ? null : world.stepped + RESPAWN_TICKS,
            lastCapture: 0,
          }
        : r,
    ),
  });
}
/** Claim the trail and every cell unreachable from a map edge without crossing own land/trail. */
export function captureCells(world: World, slot: number, trail: readonly number[]): number[] {
  const blocked = world.owners.map((owner) => owner === slot);
  for (const cell of trail) blocked[cell] = true;
  const outside = new Uint8Array(world.owners.length);
  const queue: number[] = [];
  const push = (cell: number): void => {
    if (!blocked[cell] && !outside[cell]) {
      outside[cell] = 1;
      queue.push(cell);
    }
  };
  for (let x = 0; x < world.width; x++) {
    push(x);
    push((world.height - 1) * world.width + x);
  }
  for (let y = 0; y < world.height; y++) {
    push(y * world.width);
    push(y * world.width + world.width - 1);
  }
  for (let q = 0; q < queue.length; q++)
    for (const cell of neighbours(queue[q]!, world.width, world.height)) push(cell);
  const claims = new Set(trail);
  for (let cell = 0; cell < world.owners.length; cell++)
    if (!blocked[cell] && !outside[cell]) claims.add(cell);
  return [...claims].filter((cell) => world.homes[cell] === -1 || world.homes[cell] === slot);
}

export function stepWorld(world: World, activeIds: readonly string[]): World {
  const active = new Set(activeIds);
  const stepped = world.stepped + 1;
  const source = world;
  const moving = source.runners.filter((r) => r.alive && active.has(r.id));
  const positions = new Map(
    moving.map((r) => [r.slot, neighbour(r.cell, r.queued, world.width, world.height)]),
  );
  const deaths = new Map<number, Runner['cause']>();
  const markDeath = (slot: number, cause: Exclude<Runner['cause'], null>): void => {
    const priority = { connection: 0, cut: 1, trail: 2, wall: 3, head: 4 };
    const previous = deaths.get(slot);
    if (!previous || priority[cause] > priority[previous]) deaths.set(slot, cause);
  };
  for (const r of moving) {
    const at = positions.get(r.slot)!;
    if (at < 0) {
      markDeath(r.slot, 'wall');
      continue;
    }
    if (r.trail.includes(at)) markDeath(r.slot, 'trail');
    for (const other of source.runners) {
      if (!other.alive || other.slot === r.slot) continue;
      if (other.trail.includes(at)) markDeath(other.slot, 'cut');
      const there = positions.get(other.slot) ?? other.cell;
      if (at === there || (at === other.cell && there === r.cell)) {
        markDeath(r.slot, 'head');
        markDeath(other.slot, 'head');
      }
    }
  }
  let next: World = {
    ...source,
    stepped,
    runners: source.runners.map((r) => {
      const at = positions.get(r.slot);
      return at === undefined || deaths.has(r.slot) ? r : { ...r, cell: at, dir: r.queued };
    }),
  };
  for (const [slot, cause] of deaths) next = removeRunner(next, slot, cause);
  const closing = next.runners.filter(
    (r) => positions.has(r.slot) && r.alive && next.owners[r.cell] === r.slot && r.trail.length,
  );
  if (closing.length) {
    const claims = Array<number>(next.owners.length).fill(-1);
    for (const r of closing)
      for (const cell of captureCells(next, r.slot, r.trail))
        claims[cell] = claims[cell] === -1 || claims[cell] === r.slot ? r.slot : -2;
    const owners = next.owners.map((owner, cell) =>
      next.homes[cell]! >= 0
        ? next.homes[cell]!
        : claims[cell] === -2
          ? -1
          : claims[cell]! >= 0
            ? claims[cell]!
            : owner,
    );
    next = countAreas({
      ...next,
      owners,
      runners: next.runners.map((r) =>
        closing.includes(r)
          ? {
              ...r,
              trail: [],
              captures: r.captures + 1,
              lastCapture: owners.filter(
                (owner, cell) => owner === r.slot && next.owners[cell] !== r.slot,
              ).length,
            }
          : r,
      ),
    });
  }
  return {
    ...next,
    runners: next.runners.map((r) => {
      // Returning happens after existing heads move. A revived player gets a visible
      // home frame and a steering opportunity, never an unseen same-tick collision.
      if (
        !r.alive &&
        r.respawnTick !== null &&
        r.respawnTick <= stepped &&
        active.has(r.id) &&
        !next.runners.some((other) => other.alive && other.cell === r.home)
      )
        return {
          ...r,
          cell: r.home,
          alive: true,
          trail: [],
          respawnTick: null,
          cause: null,
          dir: (r.home % world.width < world.width / 2 ? 1 : 3) as Direction,
          queued: (r.home % world.width < world.width / 2 ? 1 : 3) as Direction,
        };
      if (!positions.has(r.slot) || !r.alive || next.owners[r.cell] === r.slot) return r;
      return { ...r, trail: [...r.trail, r.cell] };
    }),
  };
}

export function tickWorld(world: World, toTick: number, activeIds: readonly string[]): World {
  let next = world;
  for (let tick = world.stepped; tick < toTick; tick++) next = stepWorld(next, activeIds);
  return next;
}
