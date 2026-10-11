import { describe, expect, it } from 'vitest';
import { drawerPoints, guessPoints } from '../server/scoring';

describe('speed points', () => {
  it('awards 100 to 500 points with a linear speed bonus', () => {
    expect(guessPoints(0, 60_000)).toBe(500);
    expect(guessPoints(15_000, 60_000)).toBe(400);
    expect(guessPoints(30_000, 60_000)).toBe(300);
    expect(guessPoints(45_000, 60_000)).toBe(200);
    expect(guessPoints(60_000, 60_000)).toBe(100);
    expect(guessPoints(-1000, 60_000)).toBe(500);
    expect(guessPoints(90_000, 60_000)).toBe(100);
    expect(guessPoints(1000, 45_000)).toBe(491);
    expect(guessPoints(1000, 75_000)).toBe(495);
  });

  it('pays the drawer for the share of eligible guessers who solve, capped at 300', () => {
    expect(drawerPoints(0, 7)).toBe(0);
    expect(drawerPoints(1, 1)).toBe(300);
    expect(drawerPoints(1, 3)).toBe(100);
    expect(drawerPoints(2, 3)).toBe(200);
    expect(drawerPoints(3, 7)).toBe(129);
    expect(drawerPoints(7, 7)).toBe(300);
    expect(drawerPoints(8, 7)).toBe(300);
    expect(drawerPoints(0, 0)).toBe(0);
  });

  it('is bounded and monotone across every millisecond in a 45-second turn', () => {
    let previous = 500;
    for (let elapsed = 0; elapsed <= 45_000; elapsed++) {
      const points = guessPoints(elapsed, 45_000);
      expect(points).toBeGreaterThanOrEqual(100);
      expect(points).toBeLessThanOrEqual(previous);
      expect(Number.isInteger(points)).toBe(true);
      previous = points;
    }
  });
});
