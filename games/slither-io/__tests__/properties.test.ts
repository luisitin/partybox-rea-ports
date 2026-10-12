// Seeded event chains exercise steering, clocks, connection changes and VIP controls.
import { expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameEvent } from '@partybox/game-sdk';
import { game } from '../server/index';
import type { Input } from '../server/types';

const kinds = ['input', 'timer', 'disconnect', 'rejoin', 'pause', 'resume', 'skip'] as const;
// Every generated run includes a real disconnect/rejoin and a timer held across a pause.
const lifecycle = [
  'input',
  'disconnect',
  'timer',
  'rejoin',
  'pause',
  'timer',
  'resume',
  'skip',
] as const;

it.each([1, 2, 3])(
  'seed %i plus 1000 generated seeds preserves JSON, purity and replay',
  (propertySeed) => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 0x7fffffff }),
        fc.array(
          fc.record({
            kind: fc.constantFrom(...kinds),
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
          const steps = [...lifecycle.map((kind) => ({ ...events[0]!, kind })), ...events];
          for (const e of steps) {
            now += e.delta;
            let event: GameEvent<Input>;
            switch (e.kind) {
              case 'input':
                event = {
                  type: 'input',
                  playerId: `p${e.slot}`,
                  input: { type: 'steer', angle: e.angle / 1000, boost: e.boost },
                  now,
                };
                break;
              case 'timer':
                now = Math.max(now, a.phase.deadline ?? now);
                event = { type: 'timer', phaseId: a.phase.id, startedAt: a.phase.startedAt, now };
                break;
              case 'disconnect':
              case 'rejoin':
                event = {
                  type: 'player',
                  playerId: `p${e.slot}`,
                  connected: e.kind === 'rejoin',
                  now,
                };
                break;
              default:
                event = { type: 'vip', action: e.kind, now };
            }
            const before = JSON.stringify(a);
            const beforeB = JSON.stringify(b);
            const eventBefore = JSON.stringify(event);
            const original = a;
            const originalB = b;
            a = game.reduce(a, event);
            b = game.reduce(b, event);
            expect(JSON.stringify(original)).toBe(before);
            expect(JSON.stringify(originalB)).toBe(beforeB);
            expect(JSON.stringify(event)).toBe(eventBefore);
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
