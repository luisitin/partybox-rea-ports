// Seeded arbitrary event traces exercise immutable JSON state, replay and safe per-seat views.
import fc from 'fast-check';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { expect, it } from 'vitest';
import { game } from '../server/index';
import type { Input } from '../server/world';
import type { State } from '../server/types';
import { T0 } from './run';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function assertJson(value: unknown): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))
    throw new Error(`Non-JSON number: ${value}`);
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  )
    throw new Error(`Non-JSON type: ${typeof value}`);
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) assertJson(child);
}

const arbitrary = fc.array(
  fc.record({
    kind: fc.integer({ min: 0, max: 9 }),
    seat: fc.constantFrom('p1', 'p2', 'p8', 'ghost', '__proto__', 'constructor'),
    drive: fc.constantFrom(-1 as const, 0 as const, 1 as const),
    turn: fc.constantFrom(-1 as const, 0 as const, 1 as const),
    flag: fc.boolean(),
    delta: fc.integer({ min: 0, max: 400 }),
  }),
  { minLength: 35, maxLength: 55 },
);

it('replays seeds 1, 2, 3 plus 1000 sampled seeds without mutations or unsafe views', () => {
  const rng = createRng(20261012);
  const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => rng.int(4, 0x3fffffff))];
  for (const seed of seeds) {
    const init = {
      players: testPlayers(2 + (seed % 7)),
      seed,
      settings: { powerups: seed % 2 === 0 },
      now: T0,
      presence: { mode: 'together' as const, phoneOnly: seed % 3 === 0 },
    };
    let state = game.init(init);
    let replay = game.init(init);
    let now = T0;
    let step = 0;
    for (const value of fc.sample(arbitrary, { seed, numRuns: 1 })[0]!) {
      now += value.delta;
      let event: GameEvent<Input>;
      switch (value.kind) {
        case 0:
          now = Math.max(now, state.phase.deadline ?? now);
          event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
          break;
        case 1:
          event = { type: 'timer', now, phaseId: 'obsolete', startedAt: state.phase.startedAt - 1 };
          break;
        case 2:
          event = { type: 'vip', now, action: 'pause' };
          break;
        case 3:
          event = { type: 'vip', now, action: 'resume' };
          break;
        case 4:
          event = { type: 'vip', now, action: 'skip' };
          break;
        case 5:
          event = { type: 'player', now, playerId: value.seat, connected: value.flag };
          break;
        case 6:
          event = { type: 'player', now, playerId: value.seat, connected: false, gone: 'left' };
          break;
        case 7:
          event = { type: 'speech', now, key: 'unrequested', ms: -1 };
          break;
        case 8:
          event = { type: 'speechStart', now, key: 'unrequested' };
          break;
        default:
          event = {
            type: 'input',
            now,
            playerId: value.seat,
            input: { type: 'control', drive: value.drive, turn: value.turn, fire: value.flag },
          };
      }
      const prior = JSON.stringify(state);
      freeze(state);
      const next = game.reduce(state, event);
      expect(JSON.stringify(state), `seed ${seed}`).toBe(prior);
      replay = game.reduce(replay, event);
      const serialized = JSON.stringify(next);
      expect(serialized, `seed ${seed}`).toBe(JSON.stringify(replay));
      expect(serialized.length, `seed ${seed}`).toBeLessThan(256 * 1024);
      assertJson(next);
      // Replay/immutability cover every event. View fuzz covers each phase change and periodic
      // checkpoints, avoiding repeated scans of the identical public maze graph.
      if (step++ % 10 === 0 || state.phase.id !== next.phase.id) {
        for (const seat of ['p1', 'p8', 'ghost', '__proto__']) {
          const view = game.controllerView(next, seat);
          assertJson(view);
          expect(JSON.stringify(JSON.parse(JSON.stringify(view))), `seed ${seed}/${seat}`).toBe(
            JSON.stringify(view),
          );
          expect(view.me.id).toBe(seat);
        }
        const tv = game.tvView(next);
        assertJson(tv);
        expect(JSON.stringify(JSON.parse(JSON.stringify(tv)))).toBe(JSON.stringify(tv));
      }
      state = next as State;
    }
  }
}, 600_000);
