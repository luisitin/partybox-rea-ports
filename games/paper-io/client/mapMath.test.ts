// Test the drawing's actual coordinate and ownership data, including irregular regions and ties.
import { describe, expect, it } from 'vitest';
import { areaPercent, cellCenter, playerInk, territoryPaths, trailPath } from './mapMath';

describe('territory paths', () => {
  it('keeps different owners and disconnected islands separate, batching horizontal runs', () => {
    const paths = territoryPaths([0, 0, -1, 1, 0, -1, 1, 1], 4, 2);
    expect([...paths]).toEqual([
      [0, 'M0 0h2v1h-2zM0 1h1v1h-1z'],
      [1, 'M3 0h1v1h-1zM2 1h2v1h-2z'],
    ]);
    expect(paths.has(-1)).toBe(false);
  });
  it('does not join rows or render cells beyond the board', () => {
    expect(territoryPaths([0, 0, 0, 0, 7], 2, 2).get(0)).toBe('M0 0h2v1h-2zM0 1h2v1h-2z');
    expect(territoryPaths([0], 0, 2).size).toBe(0);
  });
});

describe('public map coordinates', () => {
  it('places heads and trails at cell centers, including row transitions', () => {
    expect(cellCenter(0, 40)).toEqual([0.5, 0.5]);
    expect(cellCenter(1119, 40)).toEqual([39.5, 27.5]);
    expect(trailPath([39, 79, 78], 40)).toBe('M39.5 0.5L39.5 1.5L38.5 1.5');
    expect(trailPath([], 40)).toBe('');
  });
  it('shows every small initial base as a nonzero percentage', () => {
    expect(areaPercent(9, 1120)).toBe('0.8');
    expect(areaPercent(1120, 1120)).toBe('100.0');
    expect(areaPercent(0, 0)).toBe('0.0');
  });
  it('uses theme tokens for all eight seats and a safe unknown seat', () => {
    expect(playerInk(0)).toBe('var(--pb-player-1)');
    expect(playerInk(7)).toBe('var(--pb-player-8)');
    expect(playerInk(-1)).toBe('var(--pb-text-muted)');
  });
});
