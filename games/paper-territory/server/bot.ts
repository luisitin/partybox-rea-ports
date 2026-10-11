// Honest public-board strategy: grow rectangular loops, turn home before exposure gets long,
// and avoid visible trails/heads. Strength controls ambition and how far threats are watched.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { Direction, Input, Runner, State, World } from './types';
import { neighbour } from './world';

const directions = [0, 1, 2, 3] as const;
const distance = (world: World, a: number, b: number): number =>
  Math.abs((a % world.width) - (b % world.width)) +
  Math.abs(Math.floor(a / world.width) - Math.floor(b / world.width));
function safe(world: World, me: Runner, dir: Direction, watch: number): boolean {
  const at = neighbour(me.cell, dir, world.width, world.height);
  if (at < 0 || dir === (me.dir + 2) % 4 || me.trail.includes(at)) return false;
  return !world.runners.some(
    (r) =>
      r.slot !== me.slot &&
      r.alive &&
      (r.cell === at ||
        neighbour(r.cell, r.queued, world.width, world.height) === at ||
        (watch > 1 && distance(world, r.cell, at) < watch && r.trail.length > 0)),
  );
}
function segments(world: World, trail: number[]): number[] {
  const lengths = [1];
  let last = -1;
  for (let i = 1; i < trail.length; i++) {
    const delta = trail[i]! - trail[i - 1]!;
    const dir = delta === -world.width ? 0 : delta === 1 ? 1 : delta === world.width ? 2 : 3;
    if (last === -1 || dir === last) lengths[lengths.length - 1] = lengths.at(-1)! + 1;
    else lengths.push(1);
    last = dir;
  }
  return lengths;
}
function homeRoute(world: World, me: Runner, options: readonly Direction[]): Direction | null {
  // A bounded BFS only for a long/blocked trail. First move obeys the no-reverse rule.
  const occupied = new Set(me.trail);
  const seen = new Uint8Array(world.owners.length);
  const queue: [number, Direction][] = [];
  for (const dir of options) {
    const at = neighbour(me.cell, dir, world.width, world.height);
    if (at >= 0) {
      seen[at] = 1;
      queue.push([at, dir]);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const [cell, first] = queue[q]!;
    if (world.owners[cell] === me.slot) return first;
    for (const dir of directions) {
      const at = neighbour(cell, dir, world.width, world.height);
      if (at < 0 || occupied.has(at) || seen[at]) continue;
      seen[at] = 1;
      queue.push([at, first]);
    }
  }
  return null;
}
export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || !state.players[playerId]?.connected) return null;
  const me = state.world.runners.find((r) => r.id === playerId);
  if (!me?.alive) return null;
  const world = state.world;
  const span = skill === 'easy' ? 2 : skill === 'sharp' ? 5 : 3;
  const watch = skill === 'sharp' ? 2 : 1;
  let options = directions.filter((dir) => safe(world, me, dir, watch));
  if (!options.length) options = directions.filter((dir) => safe(world, me, dir, 1));
  if (!options.length) return { type: 'direction', dir: me.dir };
  let choice: Direction = options[0]!;
  if (me.trail.length) {
    const runs = segments(world, me.trail);
    const turning = runs.at(-1)! >= span;
    const turns = options.filter((dir) => dir !== me.dir);
    const threatDistance = skill === 'sharp' ? 4 : skill === 'normal' ? 2 : 0;
    const threatened =
      threatDistance > 0 &&
      world.runners.some(
        (other) =>
          other.slot !== me.slot &&
          other.alive &&
          me.trail.some((cell) => distance(world, other.cell, cell) <= threatDistance),
      );
    if (threatened || me.trail.length >= span * 4 + 3 || !options.includes(me.dir))
      choice = homeRoute(world, me, options) ?? choice;
    else if (turning && turns.length) {
      const homeward = [...turns].sort(
        (a, b) =>
          distance(world, neighbour(me.cell, a, world.width, world.height), me.home) -
          distance(world, neighbour(me.cell, b, world.width, world.height), me.home),
      );
      const best = homeward[0]!;
      const second = homeward[1];
      choice =
        second !== undefined &&
        distance(world, neighbour(me.cell, best, world.width, world.height), me.home) ===
          distance(world, neighbour(me.cell, second, world.width, world.height), me.home) &&
        rng.chance(0.5)
          ? second
          : best;
    } else choice = options.includes(me.dir) ? me.dir : choice;
  } else {
    const score = (dir: Direction): number => {
      let cell = me.cell,
        value = dir === me.dir ? 0.1 : 0;
      for (let i = 0; i < span + 2; i++) {
        cell = neighbour(cell, dir, world.width, world.height);
        if (cell < 0) return value - 20;
        if (world.owners[cell] !== me.slot) value += 1;
        if (
          skill === 'sharp' &&
          world.runners.some((r) => r.slot !== me.slot && r.trail.includes(cell))
        )
          value += 3;
      }
      return value;
    };
    choice = [...options].sort((a, b) => score(b) - score(a))[0]!;
  }
  return { type: 'direction', dir: choice };
}
