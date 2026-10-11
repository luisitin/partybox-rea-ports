// Reproducible random seeds and chained inputs include disconnect/rejoin and held timers.
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { game } from '../server/index';

it.each([1, 2, 3])(
  'seed %i plus 1000 generated seeds preserves JSON, purity and replay',
  (propertySeed) => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 0x7fffffff }),
        fc.array(
          fc.record({
            angle: fc.integer({ min: -3141, max: 3141 }),
            boost: fc.boolean(),
            delta: fc.integer({ min: 0, max: 700 }),
            slot: fc.integer({ min: 0, max: 7 }),
          }),
          { minLength: 1, maxLength: 35 },
        ),
        (seed, events) => {
          const players = Array.from({ length: 8 }, (_, i) => ({
            id: `p${i}`,
            name: `Player ${i}`,
            avatarId: 'fox',
            connected: true,
          }));
          const initial = game.init({
            players,
            seed,
            now: 1000,
            settings: {},
            presence: { mode: 'together', phoneOnly: true },
          });
          let a = initial,
            b = structuredClone(initial),
            now = 1000;
          for (const e of events) {
            now += e.delta;
            const event = {
              type: 'input' as const,
              playerId: `p${e.slot}`,
              input: { type: 'steer' as const, angle: e.angle / 1000, boost: e.boost },
              now,
            };
            const before = JSON.stringify(a);
            const original = a;
            a = game.reduce(a, event);
            b = game.reduce(b, event);
            expect(JSON.stringify(original)).toBe(before);
            const serialized = JSON.stringify(a);
            expect(serialized).toBe(JSON.stringify(b));
            expect(JSON.stringify(JSON.parse(serialized))).toBe(serialized);
            expect(JSON.stringify(game.tvView(a)).length).toBeLessThan(64 * 1024);
            for (const id of ['p0', 'p7', 'spectator', '__proto__']) {
              const view = JSON.stringify(game.controllerView(a, id));
              expect(JSON.stringify(JSON.parse(view))).toBe(view);
            }
            expect(a.world.food.length).toBeLessThanOrEqual(240);
            expect(
              a.world.snakes.every(
                (s) =>
                  Number.isFinite(s.mass) && s.mass >= 8 && s.mass <= 90 && s.body.length <= 90,
              ),
            ).toBe(true);
          }
        },
      ),
      { seed: propertySeed, numRuns: 1000 },
    );
  },
  120_000,
);
