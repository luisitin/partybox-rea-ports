import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng, seedRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { radius } from '../server/geometry';
import { game } from '../server/index';
import { makeWorld } from '../server/spawn';
import { H, MAX_CELLS, PELLET_COUNT, PHASES, ROUND_MS, STEP_MS, W } from '../server/types';
import type { Input, State, World } from '../server/types';
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

function exerciseLifecycle(seed: number, count: number, trace: number): number {
  const kit = testKit(game, { t0: T0, seed, players: testPlayers(count), inputAt: 0 });
  const ids = testPlayers(count).map((player) => player.id);
  const rng = createRng(seed);
  let state = kit.start();
  let replay = kit.start();
  let clock = T0;
  let events = 0;
  const retiredScores = new Map<string, number>();
  const check = (ok: boolean, reason: string): void => {
    if (!ok)
      throw new Error(`P05 trace=${trace} seed=${seed} n=${count} event=${events}: ${reason}`);
  };
  const invariant = (s: State): void => {
    check(PHASES.includes(s.phase.id as (typeof PHASES)[number]), 'declared phase');
    check(s.round >= 1 && s.round <= 3 && Number.isInteger(s.round), 'round bounds');
    check(Object.keys(s.players).length === count, 'stable roster');
    check(
      [s.began, s.endsAt, s.world.time, s.phase.startedAt, s.rng.seed, s.rng.step].every(
        Number.isFinite,
      ),
      'finite clocks and RNG',
    );
    check(s.phase.deadline === null || Number.isFinite(s.phase.deadline), 'finite deadline');
    check(
      s.world.time >= 0 && s.world.time <= ROUND_MS && s.world.time % STEP_MS === 0,
      'bounded physics grid',
    );
    check(
      s.world.pellets.length === PELLET_COUNT &&
        new Set(s.world.pellets.map((p) => p.id)).size === PELLET_COUNT,
      'fixed unique snacks',
    );
    check(new Set(s.world.cells.map((c) => c.id)).size === s.world.cells.length, 'unique cell IDs');
    check(
      new Set(s.left).size === s.left.length && s.left.every((id) => ids.includes(id)),
      'permanent departure membership',
    );
    for (const cell of s.world.cells) {
      check(ids.includes(cell.owner) && !s.left.includes(cell.owner), 'active cell membership');
      check(
        [cell.x, cell.y, cell.mass, cell.vx, cell.vy, cell.mergeAt, cell.shieldUntil].every(
          Number.isFinite,
        ) && cell.mass > 0,
        'finite positive cells',
      );
      const r = radius(cell.mass);
      check(
        cell.x >= r - 0.0001 &&
          cell.x <= W - r + 0.0001 &&
          cell.y >= r - 0.0001 &&
          cell.y <= H - r + 0.0001,
        'radius-aware cell bounds',
      );
    }
    for (const id of ids) {
      const score = s.scores[id];
      check(
        score !== undefined && Number.isFinite(score) && Number.isInteger(score) && score >= 0,
        `score ${id}`,
      );
      check(s.world.cells.filter((c) => c.owner === id).length <= MAX_CELLS, `cell cap ${id}`);
      const control = Object.hasOwn(s.world.controls, id) ? s.world.controls[id] : undefined;
      if (control) {
        check(
          [control.x, control.y, control.at, control.splitAt].every(Number.isFinite),
          `finite controls ${id}`,
        );
        check(
          control.at >= 0 && control.at <= ROUND_MS && Math.hypot(control.x, control.y) <= 1.0001,
          `control bounds ${id}`,
        );
        if (s.phase.paused || !s.players[id]!.connected || s.left.includes(id))
          check(control.x === 0 && control.y === 0, `inactive steering neutral ${id}`);
      }
      if (s.left.includes(id)) {
        check(
          !s.players[id]!.connected && !Object.hasOwn(s.world.respawns, id),
          `retired stays out ${id}`,
        );
        if (!retiredScores.has(id)) retiredScores.set(id, score!);
      }
    }
    for (const [id, score] of retiredScores)
      check(s.left.includes(id) && s.scores[id] === score, `retired score frozen ${id}`);
    const tv = game.tvView(s);
    check(JSON.stringify(tv.departedIds) === JSON.stringify(s.left), 'public departed seats');
    for (const id of [ids[0]!, 'spectator', '__proto__']) {
      const cv = game.controllerView(s, id);
      const known = ids.includes(id);
      const departed = s.left.includes(id);
      check(
        cv.member === (known && !departed) &&
          cv.departed === departed &&
          cv.connected === (known && !departed && !!s.players[id]?.connected),
        `explicit role ${id}`,
      );
      if (!cv.member)
        check(
          !cv.canSplit &&
            cv.respawnIn === 0 &&
            JSON.stringify(cv.arena) === JSON.stringify({ cells: tv.cells, pellets: tv.pellets }),
          `watching public stage ${id}`,
        );
      check(
        !Object.hasOwn(cv, 'rng') && !Object.hasOwn(cv, 'controls'),
        'private bookkeeping absent',
      );
      check(
        JSON.stringify(JSON.parse(JSON.stringify(cv))) === JSON.stringify(cv),
        'JSON public view',
      );
    }
  };
  const send = (event: GameEvent<Input>, unchanged = false): State => {
    const before = JSON.stringify(state);
    const eventBefore = JSON.stringify(event);
    const source = deepFreeze(state);
    const supplied = deepFreeze(event);
    const next = game.reduce(source, supplied);
    const repeated = game.reduce(deepFreeze(replay), supplied);
    events++;
    clock = Math.max(clock, event.now);
    check(
      JSON.stringify(source) === before && JSON.stringify(supplied) === eventBefore,
      'source/event immutable',
    );
    check(JSON.stringify(next) === JSON.stringify(repeated), 'deterministic reducer replay');
    if (unchanged) check(next === source, 'rejected event changed state');
    state = next;
    replay = repeated;
    invariant(state);
    return state;
  };
  const steerEvent = (id: string, x: number, y: number, now = clock): GameEvent<Input> => ({
    type: 'input',
    playerId: id,
    input: { type: 'steer', x, y },
    now,
  });
  const playerEvent = (
    id: string,
    connected: boolean,
    now = clock,
    gone?: 'left' | 'kicked',
  ): GameEvent<Input> => ({
    type: 'player',
    playerId: id,
    connected,
    now,
    ...(gone ? { gone } : {}),
  });
  const timerEvent = (now = state.phase.deadline ?? clock): GameEvent<Input> => ({
    type: 'timer',
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
    now,
  });

  invariant(state);
  send(steerEvent(ids[0]!, 1, 0, T0 + 100));
  send(timerEvent(T0 + 200));
  send(playerEvent(ids[0]!, false, T0 + 235));
  const dropped = JSON.stringify(state.world);
  send(playerEvent(ids[0]!, true, T0 + 236));
  check(JSON.stringify(state.world) === dropped, 'reconnect preserves judged world');
  send(steerEvent(ids[0]!, 1, 0, T0 + 230), true);
  send(steerEvent(ids[0]!, -1, 0, T0 + 236));
  send(steerEvent(ids[0]!, 0, 0, T0 + 270));
  send(steerEvent(ids[0]!, 0, 0, T0 + 285));
  check(state.world.controls[ids[0]!]!.at === 285, 'newer neutral timestamp');
  send(steerEvent(ids[0]!, 1, 0, T0 + 280), true);
  send({ type: 'vip', action: 'pause', now: T0 + 335 });
  send(playerEvent(ids[0]!, false, T0 + 20335));
  send(steerEvent(ids[0]!, 1, 0, T0 + 22335), true);
  send(playerEvent(ids[0]!, true, T0 + 25335));
  const held = state;
  send({ type: 'vip', action: 'resume', now: T0 + 30335 });
  check(
    JSON.stringify(state.world) === JSON.stringify(held.world),
    'resume keeps frozen physics and controls',
  );
  check(
    state.began === held.began + 30000 &&
      state.endsAt === held.endsAt + 30000 &&
      state.phase.deadline === held.phase.deadline! + 30000,
    'resume shifts absolute clocks once',
  );
  send(steerEvent(ids[0]!, -1, 0, state.began + 335));
  send(steerEvent(ids[0]!, 1, 0, state.began + 330), true);
  send(playerEvent(ids[1]!, false, clock, trace % 2 ? 'left' : 'kicked'));
  for (const connected of [true, false, true]) send(playerEvent(ids[1]!, connected));
  send(steerEvent(ids[1]!, 1, 0), true);
  for (const id of ids) send(playerEvent(id, false, clock + 1));
  send(timerEvent());
  for (const id of ids) send(playerEvent(id, true));

  for (let step = 0; step < 24; step++) {
    const id = rng.pick(ids);
    const action = rng.int(0, 11);
    if (action === 0)
      send(
        steerEvent(id, rng.int(-100, 100) / 100, rng.int(-100, 100) / 100, clock + rng.int(0, 300)),
      );
    else if (action === 1)
      send({ type: 'input', playerId: id, input: { type: 'split' }, now: clock + rng.int(0, 100) });
    else if (action === 2)
      send(timerEvent(Math.max(clock, state.phase.deadline ?? clock) + rng.int(0, 300)));
    else if (action === 3) send(playerEvent(id, false));
    else if (action === 4) send(playerEvent(id, true));
    else if (action === 5) send(playerEvent(id, false, clock, rng.chance(0.5) ? 'left' : 'kicked'));
    else if (action === 6) send({ type: 'vip', action: 'pause', now: clock + rng.int(0, 100) });
    else if (action === 7) send({ type: 'vip', action: 'resume', now: clock + rng.int(0, 1000) });
    else if (action === 8) send({ type: 'vip', action: 'skip', now: clock + rng.int(0, 300) });
    else if (action === 9) {
      const at = state.world.controls[id]?.at ?? 0;
      send(steerEvent(id, 1, 0, state.began + Math.max(state.world.time, at) - 1), true);
    } else if (action === 10)
      send(
        { type: 'input', playerId: id, input: { type: 'steer', x: NaN, y: 0 }, now: clock + 200 },
        true,
      );
    else {
      send(
        steerEvent(rng.pick(['spectator', '__proto__', 'constructor']), 1, 0, clock + 200),
        true,
      );
      send(
        {
          type: 'timer',
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
          now: clock + 100,
        },
        true,
      );
    }
  }
  let finish = 0;
  while (state.phase.id !== 'done' && finish++ < 7)
    send({ type: 'vip', action: 'skip', now: clock + 1 });
  check(state.phase.id === 'done', 'finite three-round completion');
  const results = game.results(state);
  check(
    !!results &&
      results.ranking.length === count &&
      results.ranking.every((row) => ids.includes(row.playerId) && Number.isFinite(row.score)),
    'complete final standings',
  );
  return events;
}

describe('seeded reducer lifecycle properties', () => {
  it('replays 1003 traces through release, pause, churn, invalid events and finite scoring', () => {
    const generated = createRng(0x05b0cafe);
    const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => generated.int(4, 0xffffffff))];
    const eventCounts = seeds.map((seed, trace) => exerciseLifecycle(seed, 2 + (trace % 7), trace));
    const report = {
      traces: seeds.length,
      events: eventCounts.reduce((sum, count) => sum + count, 0),
      minEventsPerTrace: Math.min(...eventCounts),
      maxEventsPerTrace: Math.max(...eventCounts),
      fixedSeeds: [1, 2, 3],
      generatedSeeds: 1000,
      generatorSeed: 0x05b0cafe,
      players: '2..8',
      randomStepsPerTrace: 24,
    };
    console.log(`P05 LIFECYCLE: ${JSON.stringify(report)}`);
    if (process.env['PB_RECORD_VERIFY'] === '1') {
      const folder = new URL('../../../jobs/P05-blob-arena/', import.meta.url);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        new URL('lifecycle-property-report.json', folder),
        JSON.stringify(report, null, 2) + '\n',
        'utf8',
      );
    }
  }, 300000);
});
