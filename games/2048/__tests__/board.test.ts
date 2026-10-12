import { describe, expect, it } from 'vitest';
import { canMove, slide, spawn } from '../server/board';

const board = (...rows: number[][]): number[] => rows.flat();
const empty = (): number[] => Array<number>(16).fill(0);

describe('2048 merge rules', () => {
  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[4, 4, 8, 8], [8, 16, 0, 0], 24],
    [[2, 0, 2, 2], [4, 2, 0, 0], 4],
    [[4, 2, 2, 4], [4, 4, 4, 0], 4],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
  ] as [number[], number[], number][])(
    'slides %j left to %j, adding %i points',
    (row, expected, gain) => {
      const source = board(row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
      const snapshot = [...source];
      const result = slide(source, 'left');
      expect(result.board.slice(0, 4)).toEqual(expected);
      expect(result.gain).toBe(gain);
      expect(result.changed).toBe(true);
      expect(source).toEqual(snapshot);
    },
  );

  it('merges once per tile from the edge being approached in all four directions', () => {
    const source = board([2, 2, 2, 2], [2, 4, 0, 0], [0, 4, 4, 0], [2, 0, 0, 2]);
    expect(slide(source, 'left')).toEqual({
      board: board([4, 4, 0, 0], [2, 4, 0, 0], [8, 0, 0, 0], [4, 0, 0, 0]),
      gain: 20,
      changed: true,
    });
    expect(slide(source, 'right')).toEqual({
      board: board([0, 0, 4, 4], [0, 0, 2, 4], [0, 0, 0, 8], [0, 0, 0, 4]),
      gain: 20,
      changed: true,
    });
    expect(slide(source, 'up')).toEqual({
      board: board([4, 2, 2, 4], [2, 8, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
      gain: 16,
      changed: true,
    });
    expect(slide(source, 'down')).toEqual({
      board: board([0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 2, 0], [4, 8, 4, 4]),
      gain: 16,
      changed: true,
    });
  });

  it('reports no change and no gain for a slide already packed without equal neighbours', () => {
    const source = board([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    expect(slide(source, 'left')).toEqual({ board: source, gain: 0, changed: false });
    expect(slide(empty(), 'up')).toEqual({ board: empty(), gain: 0, changed: false });
  });

  it('recognises blocked full boards, and finds vertical as well as horizontal merges', () => {
    const blocked = board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]);
    expect(canMove(blocked)).toBe(false);
    expect(canMove([...blocked.slice(0, 15), 0])).toBe(true);
    const horizontal = [...blocked];
    horizontal[1] = 2;
    expect(canMove(horizontal)).toBe(true);
    const vertical = board([2, 4, 8, 16], [2, 8, 16, 4], [4, 2, 4, 8], [8, 4, 8, 16]);
    expect(canMove(vertical)).toBe(true);
  });

  it('selects an empty cell by the shared normalized draw and never overwrites occupied cells', () => {
    const source = Array<number>(16).fill(8);
    source[1] = 0;
    source[7] = 0;
    source[15] = 0;
    const snapshot = [...source];
    for (const [slot, index] of [
      [0, 1],
      [21845, 1],
      [21846, 7],
      [43690, 7],
      [43691, 15],
      [65535, 15],
    ]) {
      const expected = [...source];
      expected[index!] = 4;
      expect(spawn(source, { slot: slot!, value: 4 })).toEqual(expected);
    }
    const first = [...source];
    first[1] = 2;
    expect(spawn(source, { slot: 0, value: 2 })).toEqual(first);
    expect(source).toEqual(snapshot);
    const full = Array<number>(16).fill(2);
    expect(spawn(full, { slot: 65535, value: 4 })).toEqual(full);
  });
});
