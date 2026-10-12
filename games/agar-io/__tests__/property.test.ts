import { seedRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { radius } from '../server/geometry';
import { game } from '../server/index';
import { makeWorld } from '../server/spawn';
import { H, MAX_CELLS, PELLET_COUNT, STEP_MS, W } from '../server/types';
import type { Input, World } from '../server/types';
import { apply, tick } from '../server/world';
import { deepFreeze, T0 } from './helpers';

function assertWorld(w: World): void {
  expect(w.time % STEP_MS).toBe(0);
  expect(w.pellets).toHaveLength(PELLET_COUNT);
  expect(new Set(w.pellets.map((p) => p.id)).size).toBe(PELLET_COUNT);
  expect(new Set(w.cells.map((c) => c.id)).size).toBe(w.cells.length);
  for (const c of w.cells) {
    expect(Number.isFinite(c.mass) && c.mass > 0).toBe(true);
    expect(
      Number.isFinite(c.x) &&
        Number.isFinite(c.y) &&
        Number.isFinite(c.vx) &&
        Number.isFinite(c.vy),
    ).toBe(true);
    expect(c.x).toBeGreaterThanOrEqual(radius(c.mass) - 0.0001);
    expect(c.x).toBeLessThanOrEqual(W - radius(c.mass) + 0.0001);
    expect(c.y).toBeGreaterThanOrEqual(radius(c.mass) - 0.0001);
    expect(c.y).toBeLessThanOrEqual(H - radius(c.mass) + 0.0001);
  }
  for (const id of Object.keys(w.controls))
    expect(w.cells.filter((c) => c.owner === id).length).toBeLessThanOrEqual(MAX_CELLS);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
}

function exercise(seed: number, count: number, inputs: Input[]): void {
  const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const initial = deepFreeze(makeWorld(seedRng(seed), ids));
  let [w, rng] = initial;
  let [replayed, replayRng] = initial;
  for (let i = 0; i < inputs.length; i++) {
    const id = ids[i % count]!;
    const now = (i + 1) * 200;
    const source = deepFreeze([w, rng]);
    const previous = JSON.stringify(source);
    [w, rng] = tick(w, rng, now);
    w = apply(w, id, inputs[i]!, now);
    [replayed, replayRng] = tick(replayed, replayRng, now);
    replayed = apply(replayed, id, inputs[i]!, now);
    expect([w, rng]).toEqual([replayed, replayRng]);
    expect(JSON.stringify(source)).toBe(previous);
    assertWorld(w);
  }
  expect(makeWorld(seedRng(seed), ids)).toEqual(initial);
  const state = deepFreeze(game.init({ now: T0, seed, players: testPlayers(count), settings: {} }));
  for (const id of [...ids, 'spectator', '__proto__', 'constructor']) {
    const view = game.controllerView(state, id);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(view).not.toHaveProperty('rng');
    expect(view).not.toHaveProperty('controls');
  }
  expect(JSON.stringify(state).length).toBeLessThanOrEqual(256 * 1024);
}

const steer = fc.record({
  type: fc.constant('steer' as const),
  x: fc.integer({ min: -100, max: 100 }).map((n) => n / 100),
  y: fc.integer({ min: -100, max: 100 }).map((n) => n / 100),
});
const input = fc.oneof(steer, fc.constant({ type: 'split' as const }));

describe('seeded world properties', () => {
  it.each([1, 2, 3])('pins seed %i for all party sizes and mixed controls', (seed) => {
    for (let count = 2; count <= 8; count++)
      exercise(seed, count, [
        { type: 'steer', x: 1, y: 1 },
        { type: 'steer', x: -1, y: 0 },
        { type: 'split' },
        { type: 'steer', x: 0, y: 0 },
        { type: 'steer', x: 0.1, y: -0.7 },
      ]);
  });

  it('holds for 1,000 generated seeds and mixed controls, with a reproducible fast-check seed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 0xffffffff }),
        fc.integer({ min: 2, max: 8 }),
        fc.array(input, { minLength: 5, maxLength: 12 }),
        (seed, count, inputs) => exercise(seed, count, inputs),
      ),
      { seed: 20261011, numRuns: 1000 },
    );
  }, 120000);
});
