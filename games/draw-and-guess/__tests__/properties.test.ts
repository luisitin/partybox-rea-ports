import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { testPlayers } from '@partybox/game-sdk/testing';
import type { GameEvent } from '@partybox/game-sdk';
import { fuzzOnce } from '../../../packages/game-sdk/src/contract-tests/fuzz';
import { game } from '../server/index';
import type { Input, State } from '../server/types';
import { jsonBytes, kit, stroke, T0 } from './helpers';
const STATE_SIZE_LIMIT_BYTES = 256 * 1024;

const scenario = fc.record({
  seed: fc.integer({ min: 0, max: 0x7fffffff }),
  count: fc.integer({ min: 2, max: 8 }),
  events: fc.array(fc.tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 10 })), {
    minLength: 1,
    maxLength: 32,
  }),
});

function checkTrace(example: { seed: number; count: number; events: [number, number][] }): void {
  const init = {
    players: testPlayers(example.count),
    settings: { laps: 1, drawSeconds: 30 },
    seed: example.seed,
    now: T0,
  };
  let a = game.init(init);
  let b = game.init(init);
  let now = T0;
  for (const [action, seat] of example.events) {
    now = Math.max(now + 1000, a.phase.startedAt + 1000);
    const id = [...Object.keys(a.players), 'spectator', '__proto__', 'constructor'][
      seat % (example.count + 3)
    ]!;
    let event: GameEvent<Input>;
    if (action === 0)
      event = {
        type: 'timer',
        now: Math.max(now, a.phase.deadline ?? now),
        phaseId: a.phase.id,
        startedAt: a.phase.startedAt,
      };
    else if (action === 1)
      event = { type: 'timer', now, phaseId: a.phase.id, startedAt: a.phase.startedAt - 1 };
    else if (action === 2) event = { type: 'player', now, playerId: id, connected: false };
    else if (action === 3) event = { type: 'player', now, playerId: id, connected: true };
    else if (action === 4) event = { type: 'vip', now, action: 'skip' };
    else if (action === 5) event = { type: 'vip', now, action: 'pause' };
    else if (action === 6) event = { type: 'vip', now, action: 'resume' };
    else {
      const inputs: Input[] = [
        { type: 'choose', index: seat % 3 },
        { type: 'stroke', stroke },
        { type: 'clear' },
        { type: 'undo' },
        { type: 'guess', text: a.word || 'apple' },
        { type: 'guess', text: 'wrong vocabulary' },
      ];
      event = { type: 'input', now, playerId: id, input: inputs[action - 7]! };
    }
    const before = JSON.stringify(a);
    a = game.reduce(a, event);
    b = game.reduce(b, JSON.parse(JSON.stringify(event)) as GameEvent<Input>);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(game.phases).toContain(a.phase.id);
    expect(jsonBytes(a)).toBeLessThanOrEqual(STATE_SIZE_LIMIT_BYTES);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(JSON.stringify(game.reduce(JSON.parse(before) as State, event))).toBe(JSON.stringify(a));
    expect(Object.values(a.scores).every((score) => Number.isFinite(score) && score >= 0)).toBe(
      true,
    );
    for (const unknown of ['spectator', '__proto__', 'constructor']) {
      const cv = game.controllerView(a, unknown);
      expect(cv.me.role).toBe('spectator');
      expect(cv.isDrawer).toBe(false);
      expect(cv.canGuess).toBe(false);
      expect(cv.secret).toBeUndefined();
      expect(cv.choices).toBeUndefined();
    }
  }
}

describe('seeded state-machine properties', () => {
  it.each([1, 2, 3])('checks 100 generated event traces with property seed %i', (seed) => {
    fc.assert(fc.property(scenario, checkTrace), { seed, numRuns: 100 });
  });

  it('checks another 1,000 generated random game seeds reproducibly', () => {
    fc.assert(fc.property(scenario, checkTrace), { seed: 0x50404, numRuns: 1000 });
  }, 60_000);

  it('the SDK totality fuzz survives all declared phases at seeds 1, 2 and 3', () => {
    let s = kit.start();
    for (const phase of game.phases) {
      s = kit.until(s, phase, 1000);
      for (const seed of [1, 2, 3]) expect(fuzzOnce(game, s, seed)).toEqual([]);
    }
  });
});
