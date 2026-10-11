// Honest public-board strategy: grow rectangular loops, turn home before exposure gets long,
// and avoid visible trails/heads. Strength controls ambition and how far threats are watched.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { Direction, Input, Runner, State, World } from './types';
import { neighbour } from './world';

const directions = [0, 1, 2, 3] as const;
const distance = (world: World, a: number, b: number): number =>
  Math.abs((a % world.width) - (b % world.width)) +
  Math.abs(Math.floor(a / world.width) - Math.floor(b / world.width));
function safe(world: World, me: Runner, dir: Direction, watch: number, look = 3): boolean {
  if (dir === (me.dir + 2) % 4) return false;
  let cell = me.cell;
  for (let step = 0; step < look; step++) {
    cell = neighbour(cell, dir, world.width, world.height);
    if (cell < 0 || me.trail.includes(cell)) return false;
    // Closing removes the exposed trail before the next automatic move.
    if (me.trail.length && world.owners[cell] === me.slot) break;
  }
  const at = neighbour(me.cell, dir, world.width, world.height);
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
  const occupied = new Uint8Array(world.owners.length);
  for (const cell of me.trail) occupied[cell] = 1;
  const seen = new Uint8Array(world.owners.length);
  const queue = new Int32Array(world.owners.length);
  const firstDirections = new Uint8Array(world.owners.length);
  let tail = 0;
  for (const dir of options) {
    const at = neighbour(me.cell, dir, world.width, world.height);
    if (at >= 0) {
      seen[at] = 1;
      queue[tail] = at;
      firstDirections[tail++] = dir;
    }
  }
  for (let q = 0; q < tail; q++) {
    const cell = queue[q]!,
      first = firstDirections[q]! as Direction;
    if (world.owners[cell] === me.slot) return first;
    for (const dir of directions) {
      const at = neighbour(cell, dir, world.width, world.height);
      if (at < 0 || occupied[at] || seen[at]) continue;
      seen[at] = 1;
      queue[tail] = at;
      firstDirections[tail++] = first;
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
  if (!options.length) return me.dir === me.queued ? null : { type: 'direction', dir: me.dir };
  let choice: Direction = options[0]!;
  if (me.trail.length) {
    const runs = segments(world, me.trail);
    const turning = runs.at(-1)! >= (runs.length === 3 ? Math.max(span, runs[0]!) : span);
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
    let best = -Infinity;
    for (const dir of options) {
      const value = score(dir);
      if (value > best) {
        best = value;
        choice = dir;
      }
    }
  }
  // Yield to the physics clock when the same turn is already queued.
  return choice === me.queued ? null : { type: 'direction', dir: choice };
}
