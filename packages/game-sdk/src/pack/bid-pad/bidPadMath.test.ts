import { describe, expect, it } from 'vitest';
import { addBid, chipTargets, clampBid, stepBid } from './bidPadMath';

describe('BidPad arithmetic', () => {
  it('clamps to a whole number from 0 to max', () => {
    expect([
      clampBid(-5, 100),
      clampBid(150, 100),
      clampBid(42.6, 100),
      clampBid(NaN, 100),
    ]).toEqual([0, 100, 43, 0]);
    expect(clampBid(10, 0)).toBe(0);
  });

  it('steps by 5 on the grid, never below 0 or past max', () => {
    expect(stepBid(0, 1, 5, 100)).toBe(5);
    expect(stepBid(37, 1, 5, 100)).toBe(40);
    expect(stepBid(37, -1, 5, 100)).toBe(35);
    expect(stepBid(40, -1, 5, 100)).toBe(35);
    expect(stepBid(0, -1, 5, 100)).toBe(0);
    expect(stepBid(98, 1, 5, 98)).toBe(98);
  });

  it('chips add their amount up to max; a chip that changes nothing is inert', () => {
    expect(addBid(90, 25, 100)).toBe(100);
    expect(chipTargets(90, [5, 10, 25], 100)).toEqual([
      { amount: 5, to: 95, live: true },
      { amount: 10, to: 100, live: true },
      { amount: 25, to: 100, live: true },
    ]);
    expect(chipTargets(100, [5], 100)).toEqual([{ amount: 5, to: 100, live: false }]);
  });
});

describe('a floor (an ante)', () => {
  it('never goes under `min`, and `max` wins when they cross', () => {
    expect([clampBid(0, 100, 10), clampBid(4, 100, 10), clampBid(50, 100, 10)]).toEqual([
      10, 10, 50,
    ]);
    expect(clampBid(0, 3, 10)).toBe(3); // a cap below the ante: the cap
    expect(stepBid(10, -1, 5, 100, 10)).toBe(10);
    expect(stepBid(12, -1, 5, 100, 10)).toBe(10);
    expect(addBid(10, 5, 12, 10)).toBe(12);
    expect(chipTargets(10, [5], 100, 10)).toEqual([{ amount: 5, to: 15, live: true }]);
  });
});
