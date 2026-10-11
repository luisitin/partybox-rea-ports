import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { fuzzOnce, hashState, jsonSize, makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import type { Input } from '../server/world';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function trace(seed: number): void {
  const rng = createRng(seed);
  const count = rng.int(2, 8);
  const init = { players: makePlayers(count), settings: {}, seed, now: 1_000_000 };
  let state = game.init(init);
  let replayed = game.init(init);
  let now = init.now;
  for (let step = 0; step < 24; step++) {
    now += rng.int(0, 1000);
    let event: GameEvent<unknown>;
    const playerId = rng.pick([...Object.keys(state.players), 'spectator', '__proto__']);
    switch (rng.int(0, 6)) {
      case 0:
        event = {
          type: 'input',
          now,
          playerId,
          input: { type: 'hop', dir: rng.pick(['up', 'down', 'left', 'right']) },
        };
        break;
      case 1:
        event = {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt,
        };
        break;
      case 2:
        event = {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        };
        break;
      case 3:
        event = { type: 'player', now, playerId, connected: rng.int(0, 1) === 1 };
        break;
      case 4:
        event = { type: 'vip', now, action: rng.pick(['pause', 'resume', 'skip', 'end']) };
        break;
      case 5:
        event = { type: 'speech', now, key: 'unknown-reading', ms: rng.int(-1, 1000) };
        break;
      default:
        event = {
          type: 'input',
          now: init.now - 1,
          playerId,
          input: { type: 'hop', dir: 'up' },
        };
    }
    state = game.reduce(state, event as GameEvent<Input>);
    replayed = game.reduce(replayed, event as Parameters<typeof game.reduce>[1]);
    expect(game.phases).toContain(state.phase.id);
    for (const runner of state.world.runners) {
      expect(Number.isFinite(runner.x)).toBe(true);
      expect(Number.isInteger(runner.row)).toBe(true);
      expect(runner.row).toBeGreaterThanOrEqual(0);
      if (runner.alive) expect(runner.maxRow).toBeGreaterThanOrEqual(runner.row);
      expect(runner.deaths).toBeGreaterThanOrEqual(0);
    }
  }
  expect(hashState(state), `seed ${seed}`).toBe(hashState(replayed));
  expect(jsonSize(state)).toBeLessThanOrEqual(256 * 1024);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
}

describe('seeded reducer properties', () => {
  it.each([1, 2, 3])('has deterministic, total event traces for required seed %i', trace);

  it('checks 1,000 generated seeds across every event kind and sender', () => {
    // Reproducible random seeds rather than the wall clock; the exact generator is recorded.
    const rng = createRng(0x14c0ffee);
    for (let run = 0; run < 1000; run++) trace(rng.int(1, 0x7fffffff));
  }, 120_000);

  it('cannot mutate deeply frozen state in any phase under SDK event fuzzing', () => {
    let state: State = game.init({
      players: makePlayers(8),
      settings: {},
      seed: 3,
      now: 1_000_000,
    });
    for (const phase of game.phases) {
      expect(state.phase.id).toBe(phase);
      const frozen = freeze(structuredClone(state));
      const before = hashState(frozen);
      expect(fuzzOnce(game, frozen, 3)).toEqual([]);
      expect(hashState(frozen)).toBe(before);
      state = game.reduce(state, {
        type: 'vip',
        now: state.phase.startedAt + 100,
        action: 'skip',
      });
    }
  });
});
