import { nextInt, shuffle } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { CELL, COLS, ROWS, H, W, POWERUP_KINDS, SPAWN_SAFE_MS, makeTank } from './world-core';
import type { Maze, Point, Pickup, Wall, World } from './world-core';
import { firstWall } from './collision';

export function mazeCell(maze: Maze, p: Point): number {
  const col = Math.max(0, Math.min(maze.cols - 1, Math.floor(p.x / maze.cell)));
  const row = Math.max(0, Math.min(maze.rows - 1, Math.floor(p.y / maze.cell)));
  return row * maze.cols + col;
}
export function cellCenter(maze: Maze, cell: number): Point {
  return {
    x: ((cell % maze.cols) + 0.5) * maze.cell,
    y: (Math.floor(cell / maze.cols) + 0.5) * maze.cell,
  };
}
export function mazeNeighbors(maze: Maze, cell: number): number[] {
  if (maze.passages) return maze.passages[cell] ?? [];
  const col = cell % maze.cols;
  const row = Math.floor(cell / maze.cols);
  const out: number[] = [];
  const a = cellCenter(maze, cell);
  for (const n of [cell - maze.cols, cell + 1, cell + maze.cols, cell - 1]) {
    if (n < 0 || n >= maze.cols * maze.rows) continue;
    if (Math.abs((n % maze.cols) - col) + Math.abs(Math.floor(n / maze.cols) - row) !== 1) continue;
    const b = cellCenter(maze, n);
    if (!firstWall(maze.walls, a, { x: b.x - a.x, y: b.y - a.y }, 0)) out.push(n);
  }
  return out;
}

/** A spanning tree connects every cell; a few additional doorways avoid long single-file traps. */
export function makeMaze(rng: RngState): [Maze, RngState] {
  let r = rng;
  const n = COLS * ROWS;
  const passages: number[][] = Array.from({ length: n }, () => []);
  const visited = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const at = stack.at(-1)!;
    const col = at % COLS;
    const row = Math.floor(at / COLS);
    const candidates = [at - COLS, at + 1, at + COLS, at - 1].filter(
      (to) =>
        to >= 0 &&
        to < n &&
        !visited.has(to) &&
        Math.abs((to % COLS) - col) + Math.abs(Math.floor(to / COLS) - row) === 1,
    );
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    let chosen: number;
    [chosen, r] = nextInt(r, 0, candidates.length - 1);
    const to = candidates[chosen]!;
    passages[at]!.push(to);
    passages[to]!.push(at);
    visited.add(to);
    stack.push(to);
  }
  const walls: Wall[] = [
    { x1: 0, y1: 0, x2: W, y2: 0 },
    { x1: W, y1: 0, x2: W, y2: H },
    { x1: 0, y1: H, x2: W, y2: H },
    { x1: 0, y1: 0, x2: 0, y2: H },
  ];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const at = row * COLS + col;
      for (const [to, vertical] of [
        [at + 1, true],
        [at + COLS, false],
      ] as const) {
        if (
          (vertical && col === COLS - 1) ||
          (!vertical && row === ROWS - 1) ||
          passages[at]!.includes(to)
        )
          continue;
        let door: number;
        [door, r] = nextInt(r, 0, 6);
        if (door === 0) {
          passages[at]!.push(to);
          passages[to]!.push(at);
          continue;
        }
        walls.push(
          vertical
            ? { x1: (col + 1) * CELL, y1: row * CELL, x2: (col + 1) * CELL, y2: (row + 1) * CELL }
            : { x1: col * CELL, y1: (row + 1) * CELL, x2: (col + 1) * CELL, y2: (row + 1) * CELL },
        );
      }
    }
  return [{ cols: COLS, rows: ROWS, cell: CELL, walls, passages }, r];
}

/** Select distant cells by graph distance, with seeded ties. All tanks and pickups are reachable. */
export function makeWorld(rng: RngState, ids: string[], powerups = true): [World, RngState] {
  let [maze, r] = makeMaze(rng);
  let cells: number[];
  [cells, r] = shuffle(
    r,
    Array.from({ length: COLS * ROWS }, (_, i) => i),
  );
  const spawns: number[] = [];
  const distances = Array.from({ length: COLS * ROWS }, () => Infinity);
  for (let i = 0; i < ids.length; i++) {
    const candidates = cells.filter((c) => !spawns.includes(c));
    let best = candidates[0] ?? 0;
    for (const c of candidates) if (distances[c]! > distances[best]!) best = c;
    spawns.push(best);
    const queue = [best];
    const seen = new Set<number>(queue);
    const d = Array.from({ length: COLS * ROWS }, () => Infinity);
    d[best] = 0;
    for (let q = 0; q < queue.length; q++)
      for (const to of mazeNeighbors(maze, queue[q]!)) {
        if (seen.has(to)) continue;
        seen.add(to);
        queue.push(to);
        d[to] = d[queue[q]!]! + 1;
      }
    for (let c = 0; c < distances.length; c++) distances[c] = Math.min(distances[c]!, d[c]!);
  }
  const tanks = ids.map((id, slot) => {
    const cell = spawns[slot] ?? 0;
    const p = cellCenter(maze, cell);
    const neighbor = mazeNeighbors(maze, cell)[0] ?? cell;
    const target = cellCenter(maze, neighbor);
    return makeTank(id, slot, p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x));
  });
  const free = cells.filter((c) => !spawns.includes(c));
  const pickups: Pickup[] = powerups
    ? POWERUP_KINDS.map((kind, id) => ({ id, ...cellCenter(maze, free[id] ?? 0), kind }))
    : [];
  return [
    { maze, tanks, bullets: [], pickups, stepped: 0, nextBullet: 1, safeUntil: SPAWN_SAFE_MS },
    r,
  ];
}
