// Guideline SRS shapes and kick offsets. Source coordinates point upward; grid coordinates downward.
import { H, W } from './types';
import type { ActivePiece, Grid, PieceKind, Rotation } from './types';

export const KINDS: readonly PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
type Cell = [number, number];
const SPAWN: Record<PieceKind, Cell[]> = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};
const JLSTZ: Record<string, Cell[]> = {
  '01': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '10': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '12': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '21': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '23': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '32': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '30': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '03': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};
const I_KICKS: Record<string, Cell[]> = {
  '01': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '10': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '12': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '21': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '23': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '32': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '30': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '03': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

function oriented(kind: PieceKind, rotation: number): Cell[] {
  let result = SPAWN[kind].map(([x, y]): Cell => [x, y]);
  if (kind === 'O') return result;
  const center = kind === 'I' ? 1.5 : 1;
  for (let turn = 0; turn < rotation; turn++)
    result = result.map(([x, y]): Cell => [center - (y - center), center + (x - center)]);
  return result;
}
// Internal tables are never returned directly, so callers cannot mutate shared geometry.
const SHAPES = Object.fromEntries(
  KINDS.map((kind) => [kind, [0, 1, 2, 3].map((turn) => oriented(kind, turn))]),
) as Record<PieceKind, Cell[][]>;
export function pieceCells(kind: PieceKind, rotation: Rotation = 0): Cell[] {
  return SHAPES[kind][rotation]!.map(([x, y]): Cell => [x, y]);
}
export function cells(piece: ActivePiece): Cell[] {
  return SHAPES[piece.kind][piece.rotation]!.map(([x, y]) => [x + piece.x, y + piece.y]);
}
export function fits(grid: Grid, piece: ActivePiece): boolean {
  for (const [dx, dy] of SHAPES[piece.kind][piece.rotation]!) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (x < 0 || x >= W || y < -2 || y >= H || (y >= 0 && grid[y]?.[x] !== 0)) return false;
  }
  return true;
}
export function rotate(
  grid: Grid,
  piece: ActivePiece,
  direction: 'cw' | 'ccw',
): ActivePiece | null {
  const rotation = ((piece.rotation + (direction === 'cw' ? 1 : 3)) % 4) as Rotation;
  if (piece.kind === 'O') return { ...piece, rotation };
  const kicks = (piece.kind === 'I' ? I_KICKS : JLSTZ)[`${piece.rotation}${rotation}`] ?? [];
  for (const [dx, dy] of kicks) {
    const candidate = { ...piece, rotation, x: piece.x + dx, y: piece.y - dy };
    if (fits(grid, candidate)) return candidate;
  }
  return null;
}
export function dropY(grid: Grid, piece: ActivePiece): number {
  let y = piece.y;
  while (y < H && fits(grid, { ...piece, y: y + 1 })) y++;
  return y;
}
