import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { MAX_BALLS, STEP_MS, tick } from '../server/world';
import type { Input } from '../server/world';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}

function ensure(condition: boolean, rule: string): void {
  if (!condition) throw new Error(rule);
}

function jsonValue(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    ensure(Number.isFinite(value) && !Object.is(value, -0), 'non-JSON number');
    return;
  }
  ensure(typeof value === 'object', 'non-JSON value');
  for (const child of Object.values(value as object)) jsonValue(child);
}

function invariant(state: State, previous: State, bytes: string): void {
  ensure(game.phases.includes(state.phase.id), 'undeclared phase');
  jsonValue(state);
  ensure(Buffer.byteLength(bytes) <= 256 * 1024, 'oversized state');
  ensure(state.world.balls.length <= MAX_BALLS, 'ball count exceeds cap');
  for (const paddle of state.world.paddles) {
    ensure(paddle.position >= 0 && paddle.position <= 1, 'paddle out of bounds');
    ensure(paddle.lives >= 0 && Number.isInteger(paddle.lives), 'invalid lives');
    ensure(
      paddle.lives <= previous.world.paddles.find((old) => old.id === paddle.id)!.lives,
      'lives increased',
    );
    ensure(Number.isFinite(paddle.saves), 'invalid saves');
  }
  for (const ball of state.world.balls)
    for (const value of [ball.x, ball.y, ball.vx, ball.vy, ball.readyAt])
      ensure(Number.isFinite(value), 'nonfinite ball');
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
      const before = JSON.stringify(state);
      const next = game.reduce(state, event);
      replayed = frozen(game.reduce(replayed, event));
      const after = JSON.stringify(next);
      ensure(JSON.stringify(state) === before, `mutated seed ${seed}/${i}`);
      ensure(after === JSON.stringify(replayed), `replay seed ${seed}/${i}`);
      invariant(next, state, after);
      state = frozen(next);
      eventCount++;
    }
    if (state.phase.id === 'play') {
      const to = state.world.stepped * STEP_MS + 400;
      const once = tick(state.world, to);
      ensure(
        JSON.stringify(tick(tick(state.world, to - 200), to)) === JSON.stringify(once),
        `tick partition seed ${seed}`,
      );
      ensure(tick(once, to) === once, `tick not idempotent seed ${seed}`);
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
  expect(eventCount).toBe(1003 * 24);
  const directory = resolve('jobs/P21-pong-party');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'properties.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}, 60_000);
