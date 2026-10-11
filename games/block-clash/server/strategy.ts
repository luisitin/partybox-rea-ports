// Placement heuristics are computed once per spawn, rather than on every bot button press.
import { hashString } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { dropY, fits, pieceCells } from './pieces';
import { H, W } from './types';
import type { ActivePiece, Grid, Plan, Rotation } from './types';

function evaluate(grid: Grid, piece: ActivePiece, skill: BotSkill): number {
  const trial = grid.map((row) => [...row]);
  for (const [dx, dy] of pieceCells(piece.kind, piece.rotation)) {
    const y = piece.y + dy;
    if (y < 0) return -1e9;
    trial[y]![piece.x + dx] = 1;
  }
  const cleared = trial.filter((row) => row.every((cell) => cell !== 0)).length;
  const rows = trial.filter((row) => row.some((cell) => cell === 0));
  while (rows.length < H) rows.unshift(Array<number>(W).fill(0));
  const heights = Array<number>(W).fill(0);
  let holes = 0;
  let covered = 0;
  for (let x = 0; x < W; x++) {
    let blocks = 0;
    for (let y = 0; y < H; y++) {
      if (rows[y]![x] !== 0) {
        if (heights[x] === 0) heights[x] = H - y;
        blocks++;
      } else if (heights[x]! > 0) {
        holes++;
        covered += blocks;
      }
    }
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
  const count =
    active.kind === 'O'
      ? 1
      : active.kind === 'I' || active.kind === 'S' || active.kind === 'Z'
        ? 2
        : 4;
  for (let rotation = 0; rotation < count; rotation++) {
    for (let x = -2; x < W; x++) {
      const candidate = { ...active, x, rotation: rotation as Rotation };
      if (!fits(grid, candidate)) continue;
      const y = dropY(grid, candidate);
      const noise = skill === 'easy' ? (hashString(`${salt}:${rotation}:${x}`) % 100) / 25 : 0;
      const score = evaluate(grid, { ...candidate, y }, skill) + noise;
      if (score > highest) {
        highest = score;
        best = { x, rotation: rotation as Rotation };
      }
    }
  }
  return best;
}
