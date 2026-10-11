import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { seedRng } from '@partybox/game-sdk';
import { makeWorld, tap, tick } from '../server/world';
import { roundPoints } from '../server/scoring';

const generatedCourse = fc.integer({ min: 1, max: 2_147_483_647 });
const schedule = fc.array(
  fc.record({
    wait: fc.integer({ min: 0, max: 300 }),
    tap: fc.boolean(),
    lane: fc.integer({ min: 0, max: 7 }),
  }),
  { minLength: 1, maxLength: 24 },
);

describe('seeded conservation properties', () => {
  it('checks seeds 1, 2, 3 and 1000 generated seeds for deterministic flight, grid partition and score conservation', () => {
    const check = (seed: number, events: { wait: number; tap: boolean; lane: number }[]) => {
      const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
      let [w] = makeWorld(seedRng(seed), ids);
      const [recreated] = makeWorld(seedRng(seed), ids);
      expect(w).toEqual(recreated);
      let now = 0;
      for (const e of events) {
        now += e.wait;
        const before = JSON.stringify(w);
        const direct = tick(w, now);
        const midpoint = w.checked + Math.floor((now - w.checked) / 2);
        expect(tick(tick(w, midpoint), now)).toEqual(direct);
        expect(JSON.stringify(w)).toBe(before);
        const next = e.tap ? tap(direct, ids[e.lane]!, now) : direct;
        const priorScores = roundPoints(w);
        const newScores = roundPoints(next);
        expect(next.runners).toHaveLength(8);
        for (let i = 0; i < next.runners.length; i++) {
          const r = next.runners[i]!;
          const previous = w.runners[i]!;
          expect(
            Number.isFinite(r.y) && Number.isFinite(r.velocity) && Number.isFinite(r.bestHeight),
          ).toBe(true);
          expect(r.gates).toBeGreaterThanOrEqual(previous.gates);
          expect(r.bestHeight).toBeGreaterThanOrEqual(previous.bestHeight);
          expect(newScores[r.id]).toBeGreaterThanOrEqual(priorScores[r.id]!);
          expect(newScores[r.id]).toBeGreaterThanOrEqual(r.gates * 100);
          expect(newScores[r.id]).toBeLessThan(r.gates * 100 + 100);
          expect([0, 1, 2, 3]).toContain(r.colour);
          expect(r.floor).toBe(r.gates === 0 ? 0 : r.gates * 120 - 90);
          expect(r.y).toBeGreaterThanOrEqual(r.floor);
          if (e.tap && i !== e.lane) expect(r).toEqual(direct.runners[i]);
        }
        expect(JSON.parse(JSON.stringify(next))).toEqual(next);
        expect(next.checked % 20).toBe(0);
        w = next;
      }
    };
    for (const seed of [1, 2, 3]) {
      fc.assert(
        fc.property(schedule, (events) => check(seed, events)),
        { seed, numRuns: 30 },
      );
    }
    fc.assert(fc.property(generatedCourse, schedule, check), { seed: 0x18c010, numRuns: 1000 });
  }, 60_000);
});
