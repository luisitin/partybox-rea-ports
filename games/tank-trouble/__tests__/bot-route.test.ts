// Differential regression against the original per-target BFS, independent of bot balance.
import { seedRng } from '@partybox/game-sdk';
import { expect, it } from 'vitest';
import { route, routeFromTree, routeTree } from '../server/bot';
import { cellCenter, makeWorld, mazeCell, mazeNeighbors } from '../server/world';
import type { Point, World } from '../server/world';

function independentRoute(
  world: World,
  from: Point,
  goal: Point,
): { path: number[]; visits: number } {
  const start = mazeCell(world.maze, from);
  const target = mazeCell(world.maze, goal);
  const queue = [start];
  const previous = new Map<number, number>([[start, -1]]);
  let visits = 0;
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    visits++;
    for (const n of mazeNeighbors(world.maze, queue[i]!)) {
      if (previous.has(n)) continue;
      previous.set(n, queue[i]!);
      queue.push(n);
    }
  }
  if (!previous.has(target)) return { path: [], visits };
  const out = [target];
  while (out[0] !== start) out.unshift(previous.get(out[0]!)!);
  return { path: out, visits };
}

it('keeps every target path identical across 1000 seeded mazes with one shared search', () => {
  let oldVisits = 0;
  let sharedVisits = 0;
  let decisionVisits = 0;
  let paths = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const [world] = makeWorld(seedRng(seed), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const from = world.tanks[seed % world.tanks.length]!;
    const tree = routeTree(world, from);
    // The complete BFS expands every reached cell once, regardless of the number of goals.
    sharedVisits += tree.previous.size;
    for (const goal of [...world.tanks.filter((tank) => tank.id !== from.id), ...world.pickups])
      decisionVisits += independentRoute(world, from, goal).visits;
    for (let target = 0; target < world.maze.cols * world.maze.rows; target++) {
      const goal = cellCenter(world.maze, target);
      const old = independentRoute(world, from, goal);
      const next = routeFromTree(tree, target);
      if (next.join(',') !== old.path.join(','))
        throw new Error(`Route differs at seed=${seed}, start=${tree.start}, target=${target}`);
      oldVisits += old.visits;
      paths++;
    }
    // The exported convenience API stays identical, including a same-cell target.
    const goal = world.tanks[(seed + 1) % world.tanks.length]!;
    expect(route(world, from, goal)).toEqual(independentRoute(world, from, goal).path);
    expect(routeFromTree(tree, tree.start)).toEqual([tree.start]);
  }
  expect(paths).toBe(60_000);
  expect(sharedVisits).toBe(60_000);
  expect(oldVisits / sharedVisits).toBeGreaterThan(10);
  expect(decisionVisits / sharedVisits).toBeGreaterThan(2);
  console.log(
    `Route graph visits: ${oldVisits} all-target / ${sharedVisits} shared; factor ${(oldVisits / sharedVisits).toFixed(2)}; ${paths} identical paths. Eight-seat decisions: ${decisionVisits} independent / ${sharedVisits} shared; factor ${(decisionVisits / sharedVisits).toFixed(2)}`,
  );
}, 120_000);

it('preserves an empty route to an unreachable cell', () => {
  const [world] = makeWorld(seedRng(42), ['a', 'b']);
  const isolated: World = {
    ...world,
    maze: {
      ...world.maze,
      passages: Array.from({ length: world.maze.cols * world.maze.rows }, () => []),
    },
  };
  const from = cellCenter(isolated.maze, 0);
  const goal = cellCenter(isolated.maze, 1);
  expect(route(isolated, from, goal)).toEqual(independentRoute(isolated, from, goal).path);
  expect(routeFromTree(routeTree(isolated, from), 1)).toEqual([]);
});
