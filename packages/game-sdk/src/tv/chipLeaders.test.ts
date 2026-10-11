// T-0290: who wears the strip's leader mark.
import { describe, expect, it } from 'vitest';
import { chipLeaders } from './PlayerChips';

const rows = [
  { id: 'a', score: 3 },
  { id: 'b', score: 3 },
  { id: 'c', score: 1 },
];

describe('chipLeaders', () => {
  it('marks everyone on the top score by default, nobody when all are level or at 0', () => {
    expect([...chipLeaders(rows, 3, false)]).toEqual(['a', 'b']);
    expect(
      chipLeaders(
        rows.map((r) => ({ ...r, score: 2 })),
        2,
        false,
      ).size,
    ).toBe(0);
    expect(
      chipLeaders(
        rows.map((r) => ({ ...r, score: 0 })),
        0,
        false,
      ).size,
    ).toBe(0);
  });
  it("uses the game's own leaders (a tie-break) when the strip is live", () => {
    expect([...chipLeaders(rows, 3, false, ['b'])]).toEqual(['b']);
    expect(chipLeaders(rows, 0, false, ['b']).size).toBe(0);
  });
  it('ignores them while the strip is held: the mark follows the held totals', () => {
    expect([...chipLeaders(rows, 3, true, ['c'])]).toEqual(['a', 'b']);
  });
});
