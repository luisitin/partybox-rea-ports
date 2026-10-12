import { describe, expect, it } from 'vitest';
import { standings } from './standings';

describe('the map roster', () => {
  const source = {
    players: [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Ben' },
      { id: 'c', name: 'Cy' },
    ],
    scores: { a: 9, b: 20, c: 20 },
    runners: [
      { id: 'c', slot: 2, alive: false, trail: [], deaths: 1, area: 0 },
      { id: 'a', slot: 0, alive: true, trail: [1, 2], deaths: 0, area: 9 },
      { id: 'b', slot: 1, alive: true, trail: [], deaths: 0, area: 20 },
    ],
  };

  it('keeps seat markers stable in play and shows authoritative area totals', () => {
    expect(standings(source, false).map((row) => [row.name, row.slot, row.area, row.rank])).toEqual(
      [
        ['Ana', 0, 9, 3],
        ['Ben', 1, 20, 1],
        ['Cy', 2, 20, 1],
      ],
    );
  });
  it('ranks ties equally and breaks their display order by seat number', () => {
    expect(standings(source, true).map((row) => [row.id, row.rank])).toEqual([
      ['b', 1],
      ['c', 1],
      ['a', 3],
    ]);
  });
  it('distinguishes being outside home from waiting to respawn', () => {
    const rows = standings(source, false);
    expect(rows[0]).toMatchObject({ exposed: true, alive: true });
    expect(rows[2]).toMatchObject({ exposed: false, alive: false, deaths: 1 });
  });
});
