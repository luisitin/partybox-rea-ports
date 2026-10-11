import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { hashState, jsonSize, makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { MAX_BALLS, STEP_MS, tick } from '../server/world';
import type { Input } from '../server/world';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}

function invariant(state: State, previous: State): void {
  expect(game.phases).toContain(state.phase.id);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  expect(jsonSize(state)).toBeLessThanOrEqual(256 * 1024);
  expect(state.world.balls.length).toBeLessThanOrEqual(MAX_BALLS);
  for (const paddle of state.world.paddles) {
    expect(paddle.position).toBeGreaterThanOrEqual(0);
    expect(paddle.position).toBeLessThanOrEqual(1);
    expect(paddle.lives).toBeGreaterThanOrEqual(0);
    expect(paddle.lives).toBeLessThanOrEqual(
      previous.world.paddles.find((old) => old.id === paddle.id)!.lives,
    );
    expect(Number.isInteger(paddle.lives)).toBe(true);
    expect(Number.isFinite(paddle.saves)).toBe(true);
  }
  for (const ball of state.world.balls)
    for (const value of [ball.x, ball.y, ball.vx, ball.vy, ball.readyAt])
      expect(Number.isFinite(value)).toBe(true);
}

it('property: seeds 1, 2, 3 plus 1000 seeded random cases preserve purity, bounds, replay and totality', () => {
  const source = createRng(0x20_21);
  const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => source.int(4, 0x7fffffff))];
  let eventCount = 0;
  for (const seed of seeds) {
    const rng = createRng(seed);
    const n = [2, 4, 8][rng.int(0, 2)]!;
    const context = {
      players: makePlayers(n),
      settings: {},
      seed,
      now: 1000,
      presence: { mode: 'together' as const, phoneOnly: rng.int(0, 1) === 1 },
    };
    let state = frozen(game.init(context));
    let replayed = frozen(game.init(context));
    let now = 1000;
    for (let i = 0; i < 24; i++) {
      now += rng.int(1, 1800);
      const id = `p${rng.int(1, n)}`;
      let event: GameEvent<Input>;
      switch (rng.int(0, 7)) {
        case 0:
        case 1:
        case 2:
          event = {
            type: 'input',
            now,
            playerId: id,
            input: { type: 'move', position: rng.float() },
          };
          break;
        case 3:
          event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
          break;
        case 4:
          event = { type: 'player', now, playerId: id, connected: rng.int(0, 1) === 1 };
          break;
        case 5:
          event = {
            type: 'timer',
            now,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt - 1,
          };
          break;
        case 6:
          event = {
            type: 'input',
            now,
            playerId: '__proto__',
            input: { type: 'move', position: 0.8 },
          };
          break;
        default:
          event = { type: 'vip', now, action: rng.int(0, 1) ? 'pause' : 'resume' };
      }
      const before = hashState(state);
      const next = game.reduce(state, event);
      replayed = frozen(game.reduce(replayed, event));
      expect(hashState(state), `mutated seed ${seed}/${i}`).toBe(before);
      expect(hashState(next), `replay seed ${seed}/${i}`).toBe(hashState(replayed));
      invariant(next, state);
      state = frozen(next);
      eventCount++;
    }
    if (state.phase.id === 'play') {
      const to = state.world.stepped * STEP_MS + 400;
      const once = tick(state.world, to);
      expect(tick(tick(state.world, to - 200), to), `tick partition seed ${seed}`).toEqual(once);
      expect(tick(once, to)).toBe(once);
    }
  }
  const report = {
    seeds: [1, 2, 3],
    randomGeneratorSeed: 0x20_21,
    randomCases: 1000,
    cases: seeds.length,
    events: eventCount,
    passed: true,
  };
  const directory = resolve('jobs/P21-pong-party');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'properties.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}, 60_000);
