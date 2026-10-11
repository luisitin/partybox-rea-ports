// Placement heuristics are computed once per spawn, rather than on every bot button press.
import { hashString } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { dropY, fits, pieceCells } from './pieces';
import { H, W } from './types';
import type { ActivePiece, Grid, Plan, Rotation } from './types';

type Shape = readonly (readonly [number, number])[];
interface Occupancy {
  rows: number[];
  columns: number[];
}

// These masks are local to one search. All four-cell trials copy flat numeric
// arrays rather than cloning a 20-row grid or allocating cleared-row arrays.
function occupancy(grid: Grid): Occupancy {
  const rows = Array<number>(H).fill(0);
  const columns = Array<number>(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y]![x] !== 0) {
        rows[y] = rows[y]! | (1 << x);
        columns[x] = columns[x]! | (1 << y);
      }
    }
  }
  return { rows, columns };
}

function evaluate(base: Occupancy, piece: ActivePiece, shape: Shape, skill: BotSkill): number {
  const rows = base.rows.slice();
  const columns = base.columns.slice();
  for (const [dx, dy] of shape) {
    const y = piece.y + dy;
    if (y < 0) return -1e9;
    const x = piece.x + dx;
    rows[y] = rows[y]! | (1 << x);
    columns[x] = columns[x]! | (1 << y);
  }
  let cleared = 0;
  const fullRow = (1 << W) - 1;
  for (let y = 0; y < H; y++) {
    if (rows[y] !== fullRow) continue;
    cleared++;
    // Row zero is the low bit. Removing row y and padding an empty row at the
    // top shifts only rows above y down one. Ascending y preserves the original
    // index of every later row selected for clearing.
    const above = (1 << y) - 1;
    const through = (1 << (y + 1)) - 1;
    for (let x = 0; x < W; x++) {
      const bits = columns[x]!;
      columns[x] = ((bits & above) << 1) | (bits & ~through);
    }
  }
  const heights = Array<number>(W).fill(0);
  let holes = 0;
  let covered = 0;
  for (let x = 0; x < W; x++) {
    let remaining = columns[x]!;
    if (remaining === 0) continue;
    const first = remaining & -remaining;
    heights[x] = H - (31 - Math.clz32(first));
    let blocks = 0;
    let rowSum = 0;
    while (remaining !== 0) {
      const bit = remaining & -remaining;
      rowSum += 31 - Math.clz32(bit);
      blocks++;
      remaining ^= bit;
    }
    holes += heights[x]! - blocks;
    // Sum, for every block, the holes below it. This is exactly the original
    // scan's sum of blocks-above for every hole, with integer arithmetic.
    covered += blocks * (H - blocks) - rowSum + (blocks * (blocks - 1)) / 2;
  }
  const sum = heights.reduce((a, b) => a + b, 0);
  const max = Math.max(...heights);
  const bump = heights.slice(1).reduce((a, h, x) => a + Math.abs(h - heights[x]!), 0);
  let wells = 0;
  for (let x = 0; x < W; x++)
    wells += Math.max(0, Math.min(heights[x - 1] ?? H, heights[x + 1] ?? H) - heights[x]! - 1);
  if (skill === 'easy') return cleared * 7 - sum * 0.3 - holes * 3 - bump * 0.2;
  return (
    cleared * (skill === 'sharp' ? 11 : 9) -
    sum * 0.5 -
    holes * 8 -
    bump * 0.5 -
    max * 0.9 -
    covered * (skill === 'sharp' ? 0.5 : 0.15) -
    wells * 0.3
  );
}

export function placement(grid: Grid, active: ActivePiece, skill: BotSkill, salt: string): Plan {
  let best: Plan = { x: active.x, rotation: active.rotation };
  let highest = -Infinity;
  const base = occupancy(grid);
  const count =
    active.kind === 'O'
      ? 1
      : active.kind === 'I' || active.kind === 'S' || active.kind === 'Z'
        ? 2
        : 4;
  for (let rotation = 0; rotation < count; rotation++) {
    const shape = pieceCells(active.kind, rotation as Rotation);
    for (let x = -2; x < W; x++) {
      const candidate = { ...active, x, rotation: rotation as Rotation };
      if (!fits(grid, candidate)) continue;
      const y = dropY(grid, candidate);
      const noise = skill === 'easy' ? (hashString(`${salt}:${rotation}:${x}`) % 100) / 25 : 0;
      const score = evaluate(base, { ...candidate, y }, shape, skill) + noise;
      if (score > highest) {
        highest = score;
        best = { x, rotation: rotation as Rotation };
      }
    }
  }
  return best;
}
