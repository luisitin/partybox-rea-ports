import { describe, expect, it } from 'vitest';
import { TOWER_MAX, towerOf } from './Kitchen';

describe('towerOf', () => {
  it('is empty until the room scores, and never grows past the cap', () => {
    expect(towerOf(0, 40)).toBe(0);
    expect(towerOf(10, 0)).toBe(0);
    expect(towerOf(40, 40)).toBe(TOWER_MAX);
    expect(towerOf(400, 40)).toBe(TOWER_MAX);
  });

  it('shows at least one piece for any score, then grows with the share of the points', () => {
    expect(towerOf(1, 400)).toBe(1);
    expect(towerOf(20, 40)).toBe(TOWER_MAX / 2);
    expect(towerOf(30, 40)).toBeGreaterThan(towerOf(20, 40));
  });
});
