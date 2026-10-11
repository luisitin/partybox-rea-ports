import { describe, expect, it } from 'vitest';
import { emptyGrid } from '../server/engine';
import { cells, dropY, fits, pieceCells, rotate } from '../server/pieces';
import { pieceAt } from '../server/sequence';
import type { PieceKind } from '../server/types';

const KINDS: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

describe('seven-bag sequence', () => {
  it.each([1, 2, 3, 937])('has each kind once per bag for seed %i', (seed) => {
    for (let bag = 0; bag < 30; bag++) {
      const pieces = Array.from({ length: 7 }, (_, i) => pieceAt(seed, bag * 7 + i));
      expect(pieces.sort()).toEqual([...KINDS].sort());
    }
  });

  it('reproduces the same sequence and changes its ordering with the room seed', () => {
    const sequence = (seed: number) => Array.from({ length: 70 }, (_, i) => pieceAt(seed, i));
    expect(sequence(1)).toEqual(sequence(1));
    expect(sequence(1)).not.toEqual(sequence(2));
  });
});

describe('tetromino cells and SRS', () => {
  it('every orientation has four distinct integer cells', () => {
    for (const kind of KINDS) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const shape = pieceCells(kind, rotation);
        expect(shape).toHaveLength(4);
        expect(new Set(shape.map(([x, y]) => `${x},${y}`)).size).toBe(4);
        expect(shape.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
      }
    }
  });

  it('translates local cells into the active piece position', () => {
    const p = { kind: 'T' as const, x: 3, y: 5, rotation: 0 as const };
    expect(cells(p)).toEqual(pieceCells('T').map(([x, y]) => [x + 3, y + 5]));
  });

  it('rejects a wall, floor and occupied cell while permitting hidden spawn cells', () => {
    const grid = emptyGrid();
    const p = { kind: 'T' as const, x: 3, y: 5, rotation: 0 as const };
    expect(fits(grid, p)).toBe(true);
    expect(fits(grid, { ...p, x: -1 })).toBe(false);
    expect(fits(grid, { ...p, x: 8 })).toBe(false);
    expect(fits(grid, { ...p, y: 19 })).toBe(false);
    expect(fits(grid, { ...p, y: -2 })).toBe(true);
    const [x, y] = cells(p)[0]!;
    grid[y]![x] = 8;
    expect(fits(grid, p)).toBe(false);
  });

  it('uses the JLSTZ right kick at the left wall', () => {
    const p = { kind: 'T' as const, x: -1, y: 5, rotation: 1 as const };
    expect(fits(emptyGrid(), p)).toBe(true);
    expect(rotate(emptyGrid(), p, 'cw')).toMatchObject({ x: 0, y: 5, rotation: 2 });
  });

  it('uses the I-specific two-column kick at the left wall', () => {
    const p = { kind: 'I' as const, x: -2, y: 5, rotation: 1 as const };
    expect(fits(emptyGrid(), p)).toBe(true);
    expect(rotate(emptyGrid(), p, 'cw')).toMatchObject({ x: 0, y: 5, rotation: 2 });
  });

  it('uses floor kicks with screen y increasing downwards', () => {
    const grid = emptyGrid();
    expect(rotate(grid, { kind: 'T', x: 3, y: 18, rotation: 0 }, 'cw')).toMatchObject({
      x: 2,
      y: 17,
      rotation: 1,
    });
    expect(rotate(grid, { kind: 'I', x: 3, y: 18, rotation: 0 }, 'cw')).toMatchObject({
      x: 4,
      y: 16,
      rotation: 1,
    });
  });

  it('cycles clockwise and counterclockwise without drift on an empty board', () => {
    for (const kind of KINDS) {
      const original = { kind, x: 3, y: 5, rotation: 0 as const };
      for (const direction of ['cw', 'ccw'] as const) {
        let p = original as Parameters<typeof cells>[0];
        for (let i = 0; i < 4; i++) p = rotate(emptyGrid(), p, direction) ?? p;
        expect(cells(p)).toEqual(cells(original));
      }
    }
  });

  it('hard drop stops at the first stack surface and does not mutate the grid', () => {
    const grid = emptyGrid();
    grid[15]![4] = 8;
    const p = { kind: 'O' as const, x: 3, y: 0, rotation: 0 as const };
    const before = JSON.stringify(grid);
    const y = dropY(grid, p);
    expect(y).toBe(13);
    expect(fits(grid, { ...p, y })).toBe(true);
    expect(fits(grid, { ...p, y: y + 1 })).toBe(false);
    expect(JSON.stringify(grid)).toBe(before);
  });

  it('refuses a rotation when all five SRS candidates are blocked', () => {
    const p = { kind: 'T' as const, x: 3, y: 5, rotation: 0 as const };
    const grid = Array.from({ length: 20 }, () => Array<number>(10).fill(8));
    for (const [x, y] of cells(p)) grid[y]![x] = 0;
    expect(fits(grid, p)).toBe(true);
    expect(rotate(grid, p, 'cw')).toBeNull();
  });
});
