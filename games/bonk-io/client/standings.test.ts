import { describe, expect, it } from 'vitest';
import { clockText, secondsLeft, standingsRows } from './standings';

describe('public standings', () => {
  it('preserves slots and shows the same competition rank for tied totals', () => {
    const view = {
      players: [
        { id: 'a', name: 'Ana', connected: true },
        { id: 'b', name: 'Ben', connected: false },
        { id: 'c', name: 'Cam', connected: true },
      ],
      balls: [
        { id: 'a', slot: 5, alive: false, heavy: false, cause: 'left' },
        { id: 'b', slot: 1, alive: true, heavy: true, cause: null },
        { id: 'c', slot: 2, alive: false, heavy: false, cause: 'fall' },
      ],
      scores: { a: 2, b: 2, c: 0 },
      lastPoints: { b: 1 },
    };
    const ranked = standingsRows(view, 'b', true);
    expect(ranked.map((row) => [row.id, row.rank, row.tied])).toEqual([
      ['b', 1, true],
      ['a', 1, true],
      ['c', 3, false],
    ]);
    expect(ranked[0]).toMatchObject({
      slot: 1,
      heavy: true,
      connected: false,
      me: true,
      gained: 1,
    });
    expect(ranked[1]?.departed).toBe(true);
    expect(standingsRows(view).map((row) => row.slot)).toEqual([1, 2, 5]);
  });

  it('rounds deadlines up, clamps expired clocks and formats whole seconds', () => {
    expect(secondsLeft(3001, 1001)).toBe(2);
    expect(secondsLeft(3001, 1000)).toBe(3);
    expect(secondsLeft(3001, 4000)).toBe(0);
    expect(secondsLeft(null, 1000)).toBe(0);
    expect(clockText(30)).toBe('0:30');
    expect(clockText(60)).toBe('1:00');
  });
});
