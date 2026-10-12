// Seeded event chains exercise steering, clocks, connection changes and VIP controls.
import { ok, strictEqual } from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { it } from 'vitest';
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
    const begun = performance.now();
    let traces = 0;
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
            strictEqual(JSON.stringify(original), before, 'First source is immutable');
            strictEqual(JSON.stringify(originalB), beforeB, 'Replay source is immutable');
            strictEqual(JSON.stringify(event), eventBefore, 'Event is immutable');
            const serialized = JSON.stringify(a);
            strictEqual(serialized, JSON.stringify(b), 'Byte-identical deterministic replay');
            strictEqual(JSON.stringify(JSON.parse(serialized)), serialized, 'JSON state roundtrip');
            ok(Buffer.byteLength(serialized, 'utf8') < 256 * 1024, 'State byte budget');
            ok(
              Buffer.byteLength(JSON.stringify(game.tvView(a)), 'utf8') < 64 * 1024,
              'TV byte budget',
            );
            for (const id of ['p0', 'p7', 'spectator', '__proto__']) {
              const view = JSON.stringify(game.controllerView(a, id));
              strictEqual(JSON.stringify(JSON.parse(view)), view, 'Controller JSON roundtrip');
              ok(Buffer.byteLength(view, 'utf8') < 64 * 1024, 'Controller byte budget');
            }
            ok(a.world.food.length <= 240, 'Food count remains bounded');
            ok(
              a.world.snakes.every(
                (s) =>
                  Number.isFinite(s.mass) && s.mass >= 8 && s.mass <= 90 && s.body.length <= 90,
              ),
              'Finite mass and bounded bodies',
            );
          }
          traces++;
        },
      ),
      { seed: propertySeed, numRuns: 1000 },
    );
    strictEqual(traces, 1000, 'All generated traces completed');
    console.log(
      `Slither.io properties seed ${propertySeed}: ${traces} complete traces in ${Math.round(performance.now() - begun)} ms.`,
    );
  },
  120_000,
);
