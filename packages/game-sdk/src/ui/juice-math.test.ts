import { describe, expect, it } from 'vitest';
import { burstMs, JUICE_KINDS, particlesOf, seedOf } from './juice-math';

describe('particlesOf', () => {
  it('is the same burst for the same seed and a different one for another', () => {
    for (const kind of JUICE_KINDS) {
      expect(particlesOf(kind, seedOf('yahtzee/1'))).toEqual(
        particlesOf(kind, seedOf('yahtzee/1')),
      );
      expect(particlesOf(kind, 1)).not.toEqual(particlesOf(kind, 2));
    }
  });

  it('keeps every particle finite, bounded and inside its kind', () => {
    for (const kind of JUICE_KINDS) {
      const ps = particlesOf(kind, 7);
      expect(ps.length).toBeGreaterThan(0);
      for (const p of ps) {
        expect(Object.values(p).every(Number.isFinite)).toBe(true);
        expect(p.tone).toBeGreaterThanOrEqual(0);
        expect(p.tone).toBeLessThan(4);
        expect(p.delay).toBeLessThanOrEqual(90);
      }
      expect(burstMs(kind)).toBeLessThan(2500);
    }
  });

  it('honours count, capped so a bad call cannot flood the compositor', () => {
    expect(particlesOf('sparks', 1, 5)).toHaveLength(5);
    expect(particlesOf('sparks', 1, 0)).toHaveLength(0);
    expect(particlesOf('sparks', 1, 9999)).toHaveLength(120);
  });

  it('coins fly up and fall; dust only drifts up', () => {
    expect(particlesOf('coins', 3).every((p) => p.dy < 0 && p.fall > 0)).toBe(true);
    expect(particlesOf('dust', 3).every((p) => p.fall <= 0)).toBe(true);
  });
});
