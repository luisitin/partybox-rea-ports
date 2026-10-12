import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { scoresOf } from '../server/scoring';
import { HEIGHT, MAX_SINKS, WIDTH } from '../server/types';
import { radiusOf, tick } from '../server/world';
import { freeze, move, start } from './helpers';

describe('seeded city properties', () => {
  it.each([1, 2, 3])(
    'passes 1,000 randomized city seeds with property seed %i',
    (propertySeed) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 0x7fffffff }),
          fc.integer({ min: 2, max: 8 }),
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: 200, max: 2000 }),
          (seed, count, x, y, elapsed) => {
            let s = start(count, seed);
            for (const h of s.world.holes) s = move(s, h.id, x / 100, y / 100);
            const before = JSON.stringify(s);
            freeze(s);
            const single = tick(s.world, elapsed);
            const chunks = tick(tick(s.world, Math.floor(elapsed / 2)), elapsed);
            expect(chunks).toEqual(single);
            expect(tick(s.world, elapsed)).toEqual(single);
            expect(JSON.stringify(s)).toBe(before);
            expect(single.elapsed).toBe(Math.floor(elapsed / 100) * 100);
            expect(JSON.parse(JSON.stringify(single))).toEqual(single);
            expect(single.sinks.length).toBeLessThanOrEqual(MAX_SINKS);
            expect(single.sinks.every((sink) => single.elapsed - sink.consumedAt < 700)).toBe(true);
            for (const h of single.holes) {
              const r = radiusOf(h.mass);
              expect(h.x).toBeGreaterThanOrEqual(r - 0.0001);
              expect(h.x).toBeLessThanOrEqual(WIDTH - r + 0.0001);
              expect(h.y).toBeGreaterThanOrEqual(r - 0.0001);
              expect(h.y).toBeLessThanOrEqual(HEIGHT - r + 0.0001);
              expect(Number.isInteger(h.score) && h.score >= 0).toBe(true);
              expect(h.mass).toBeLessThanOrEqual(h.score);
              if (!h.alive) {
                expect(h.dx).toBe(0);
                expect(h.dy).toBe(0);
              }
            }
            const settled = { ...s, world: single, scores: scoresOf(single) };
            expect(Buffer.byteLength(JSON.stringify(settled))).toBeLessThan(256 * 1024);
            expect(JSON.parse(JSON.stringify(game.tvView(settled)))).toEqual(game.tvView(settled));
          },
        ),
        { seed: propertySeed, numRuns: 1000, endOnFailure: true },
      );
    },
    60_000,
  );
});
