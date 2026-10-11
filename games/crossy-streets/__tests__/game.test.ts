import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { SCORE_MS } from '../server/types';
import {
  HOP_MS,
  IDLE_MS,
  RESPAWN_GRACE_MS,
  RESPAWN_MS,
  ROUND_MS,
  ROWS,
  STEP_MS,
  TICK_MS,
  WIDTH,
  apply,
  createWorld,
  laneObjectsAt,
  safeAt,
  tick,
} from '../server/world';
import type { Lane, Runner, World } from '../server/world';

const T0 = 1_000_000;
const HOP = Math.ceil(HOP_MS / STEP_MS) * STEP_MS;
const kit = testKit(game, { t0: T0, players: testPlayers(4) });
const grass = (row: number, extra: Partial<Lane> = {}): Lane => ({
  row,
  kind: 'grass',
  direction: 1,
  speed: 0,
  period: 22,
  offset: 0,
  objects: [],
  blocked: [],
  ...extra,
});
const runner = (extra: Partial<Runner> = {}): Runner => ({
  id: 'p1',
  slot: 0,
  x: 7,
  row: 0,
  alive: true,
  reviveAt: null,
  lastProgressAt: 0,
  maxRow: 0,
  deaths: 0,
  lastHopAt: -HOP_MS,
  checkpointRow: 0,
  checkpointX: 7,
  lastDeath: null,
  protectedUntil: 0,
  ...extra,
});
const world = (
  r: Runner = runner(),
  lanes = Array.from({ length: 20 }, (_, row) => grass(row)),
): World => ({
  lanes,
  runners: [r],
  stepped: 0,
});
const road = (row: number, extra: Partial<Lane> = {}): Lane =>
  grass(row, {
    kind: 'road',
    objects: [{ x: 6, length: 2, variant: 0 }],
    ...extra,
  });
const river = (row: number, extra: Partial<Lane> = {}): Lane =>
  grass(row, {
    kind: 'river',
    objects: [{ x: 0, length: 20, variant: 0 }],
    ...extra,
  });

describe('seeded lanes and public geometry', () => {
  it('makes one fixed map independent of the number or order of racers', () => {
    const players = testPlayers(8);
    const [full, rng] = createWorld(players, seedRng(14));
    const [short, shortRng] = createWorld(players.slice(0, 2), seedRng(14));
    const [reversed] = createWorld([...players].reverse(), seedRng(14));
    const [different] = createWorld(players, seedRng(15));
    expect(full.lanes).toEqual(short.lanes);
    expect(full.lanes).toEqual(reversed.lanes);
    expect(rng).toEqual(shortRng);
    expect(full.lanes).not.toEqual(different.lanes);
    expect(full.lanes).toHaveLength(ROWS);
    expect(full.runners.map((r) => r.id)).toEqual(players.map((p) => p.id));
    for (let row = 0; row < ROWS; row++) {
      const lane = full.lanes[row]!;
      expect(lane.row).toBe(row);
      if (row < 3 || row % 4 === 2 || row === ROWS - 1) expect(lane.kind).toBe('grass');
      if (lane.kind === 'grass') expect(lane.blocked).not.toContain(7);
      expect(lane.speed).toBeGreaterThanOrEqual(0);
      expect(lane.blocked.every((x) => x >= 0 && x < WIDTH)).toBe(true);
    }
  });

  it('moves and wraps hazards in both directions, including copies crossing the left edge', () => {
    const lane = road(1, { speed: 2, objects: [{ x: 21, length: 3, variant: 2 }] });
    expect(laneObjectsAt(lane, 0)).toEqual([{ x: -1, length: 3, variant: 2 }]);
    expect(laneObjectsAt(lane, 1000)).toEqual([{ x: 1, length: 3, variant: 2 }]);
    expect(
      laneObjectsAt({ ...lane, direction: -1, objects: [{ x: 1, length: 3, variant: 2 }] }, 1000),
    ).toEqual([{ x: -1, length: 3, variant: 2 }]);
    expect(laneObjectsAt(grass(0), 1000)).toEqual([]);
  });

  it('tests the whole runner radius for cars/logs and never treats water gaps as land', () => {
    expect(safeAt(road(1), 7, 0)).toBe(false);
    expect(safeAt(road(1), 5.5, 0)).toBe(true);
    expect(safeAt(river(1, { objects: [{ x: 6, length: 2, variant: 0 }] }), 7, 0)).toBe(true);
    expect(safeAt(river(1, { objects: [{ x: 6, length: 2, variant: 0 }] }), 6.1, 0)).toBe(false);
    expect(safeAt(river(1, { objects: [] }), 7, 0)).toBe(false);
    expect(safeAt(grass(0, { blocked: [7] }), 7, 0)).toBe(false);
    expect(safeAt(grass(0), -1, 0)).toBe(false);
    expect(safeAt(grass(0), WIDTH, 0)).toBe(false);
  });
});

describe('hops, crashes, progress and respawning', () => {
  it('hops one cell, clamps the bottom, and rejects unknown racers and too-fast repeats', () => {
    const initial = world();
    expect(apply(initial, 'unknown', { type: 'hop', dir: 'up' }, 0)).toBe(initial);
    expect(apply(initial, 'p1', { type: 'hop', dir: 'down' }, 0)).toBe(initial);
    const first = apply(initial, 'p1', { type: 'hop', dir: 'up' }, 0);
    expect(first.runners[0]?.row).toBe(1);
    expect(first.runners[0]?.maxRow).toBe(1);
    expect(apply(first, 'p1', { type: 'hop', dir: 'up' }, HOP_MS - 1)).toBe(first);
    expect(apply(first, 'p1', { type: 'hop', dir: 'up' }, HOP).runners[0]?.row).toBe(2);
    const sampled = tick(first, 300);
    expect(apply(sampled, 'p1', { type: 'hop', dir: 'up' }, 250)).toBe(sampled);
  });

  it('a tree blocks a hop without consuming it or awarding points', () => {
    const initial = world(runner(), [grass(0), grass(1, { blocked: [7] })]);
    expect(apply(initial, 'p1', { type: 'hop', dir: 'up' }, 100)).toBe(initial);
    const aside = apply(initial, 'p1', { type: 'hop', dir: 'left' }, 100);
    expect(aside.runners[0]?.x).toBe(6);
    expect(aside.runners[0]?.maxRow).toBe(0);
  });

  it.each(['car', 'water'] as const)(
    'a lethal %s destination scores no new row and starts one respawn',
    (reason) => {
      const hazard = reason === 'car' ? road(1) : river(1, { objects: [] });
      const hit = apply(world(runner(), [grass(0), hazard]), 'p1', { type: 'hop', dir: 'up' }, 0);
      expect(hit.runners[0]).toMatchObject({
        alive: false,
        maxRow: 0,
        deaths: 1,
        lastDeath: reason,
        reviveAt: RESPAWN_MS,
      });
      expect(apply(hit, 'p1', { type: 'hop', dir: 'up' }, 500)).toBe(hit);
      expect(tick(hit, RESPAWN_MS - STEP_MS).runners[0]?.alive).toBe(false);
      const returned = tick(hit, RESPAWN_MS).runners[0]!;
      expect(returned).toMatchObject({ alive: true, row: 0, x: 7, deaths: 1, reviveAt: null });
      expect(returned.protectedUntil).toBe(RESPAWN_MS + RESPAWN_GRACE_MS);
    },
  );

  it('side edges kill rather than wrapping to the other side', () => {
    const initial = world(runner({ x: 0 }));
    const hit = apply(initial, 'p1', { type: 'hop', dir: 'left' }, 0).runners[0]!;
    expect(hit).toMatchObject({ x: -1, alive: false, lastDeath: 'edge', maxRow: 0 });
  });

  it('remembers the farthest safe row across backward hops and crashes', () => {
    let state = world();
    state = apply(state, 'p1', { type: 'hop', dir: 'up' }, 0);
    state = apply(state, 'p1', { type: 'hop', dir: 'up' }, HOP);
    const progressAt = state.runners[0]!.lastProgressAt;
    state = apply(state, 'p1', { type: 'hop', dir: 'down' }, HOP * 2);
    state = apply(state, 'p1', { type: 'hop', dir: 'up' }, HOP * 3);
    expect(state.runners[0]).toMatchObject({
      row: 2,
      maxRow: 2,
      checkpointRow: 2,
      lastProgressAt: progressAt,
    });
    const hit = apply(
      { ...state, runners: [{ ...state.runners[0]!, x: 0 }] },
      'p1',
      { type: 'hop', dir: 'left' },
      HOP * 4,
    );
    expect(hit.runners[0]?.maxRow).toBe(2);
    const returned = tick(hit, HOP * 4 + RESPAWN_MS).runners[0]!;
    expect(returned).toMatchObject({ row: 2, x: 7, maxRow: 2, alive: true });
  });

  it('the eagle uses new progress, so sideways movement cannot keep an idle racer alive', () => {
    let state = world();
    state = apply(state, 'p1', { type: 'hop', dir: 'up' }, 1000);
    state = tick(state, 7000);
    state = apply(state, 'p1', { type: 'hop', dir: 'left' }, 7000);
    expect(state.runners[0]?.lastProgressAt).toBe(1000);
    expect(tick(state, 1000 + IDLE_MS - STEP_MS).runners[0]?.alive).toBe(true);
    const hit = tick(state, 1000 + IDLE_MS);
    expect(hit.runners[0]).toMatchObject({ alive: false, lastDeath: 'eagle', maxRow: 1 });
    const returned = tick(hit, 1000 + IDLE_MS + RESPAWN_MS);
    expect(returned.runners[0]?.lastProgressAt).toBe(1000);
    expect(returned.runners[0]?.alive).toBe(true);
    expect(tick(returned, 1000 + IDLE_MS + RESPAWN_MS + RESPAWN_GRACE_MS).runners[0]?.alive).toBe(
      false,
    );
  });

  it.each(['easy', 'normal', 'sharp'] as const)(
    '%s bots can recover three lost rows after an eagle instead of repeating deaths',
    (skill) => {
      const initial = world(runner({ row: 5, maxRow: 5, checkpointRow: 2 }));
      const caught = tick(initial, IDLE_MS);
      expect(caught.runners[0]).toMatchObject({ alive: false, lastDeath: 'eagle', deaths: 1 });
      let recovering = tick(caught, IDLE_MS + RESPAWN_MS);
      const graceEnds = recovering.runners[0]!.protectedUntil;
      expect(recovering.runners[0]).toMatchObject({ row: 2, maxRow: 5, alive: true });
      const rng = createRng(14);
      while (recovering.stepped < graceEnds && recovering.runners[0]!.maxRow === 5) {
        const input = botInput(recovering, 'p1', rng, skill);
        if (input) recovering = apply(recovering, 'p1', input, recovering.stepped);
        if (recovering.runners[0]!.maxRow > 5) break;
        recovering = tick(recovering, recovering.stepped + TICK_MS);
      }
      expect(recovering.runners[0]).toMatchObject({ alive: true, maxRow: 6, deaths: 1 });
      expect(recovering.runners[0]!.lastProgressAt).toBeLessThan(graceEnds);
      expect(tick(recovering, graceEnds).runners[0]).toMatchObject({ alive: true, deaths: 1 });
    },
  );

  it('judges intermediate samples, with identical results for a delayed or partitioned tick', () => {
    const initial = world(runner({ row: 1, maxRow: 1 }), [
      grass(0),
      road(1, {
        speed: 20,
        objects: [{ x: 0, length: 1, variant: 0 }],
      }),
    ]);
    const once = tick(initial, 500);
    const parts = tick(tick(tick(initial, 100), 250), 500);
    expect(once).toEqual(parts);
    expect(once.runners[0]?.lastDeath).toBe('car');
    expect(once.runners[0]?.reviveAt).toBeLessThan(500 + RESPAWN_MS);
    expect(tick(once, 500)).toBe(once);
    expect(tick(once, 450)).toBe(once);
  });

  it('logs carry racers with the current and can carry them over an edge', () => {
    const initial = world(runner({ row: 1, maxRow: 1 }), [grass(0), river(1, { speed: 1 })]);
    expect(tick(initial, 1000).runners[0]?.x).toBeCloseTo(8, 6);
    expect(tick(initial, 1000).runners[0]?.alive).toBe(true);
    const nearEdge = { ...initial, runners: [{ ...initial.runners[0]!, x: 14 }] };
    expect(tick(nearEdge, 500).runners[0]).toMatchObject({ alive: false, lastDeath: 'edge' });
  });
});

describe('match lifecycle and views', () => {
  it('starts immediately, judges at 50 ms, and re-arms data beats without moving the phase key', () => {
    const state = kit.start();
    expect(STEP_MS).toBe(50);
    expect(state.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + TICK_MS });
    expect(state.endsAt - state.began).toBe(ROUND_MS);
    expect(state.seconds).toBe(60);
    const next = kit.timer(state);
    expect(next.phase.id).toBe('play');
    expect(next.phase.startedAt).toBe(state.phase.startedAt);
    expect(next.phase.deadline).toBe(T0 + TICK_MS * 2);
    expect(next.checked).toBe(TICK_MS);
  });

  it('ignores early, wrong-phase, stale-generation timers and old inputs', () => {
    const state = kit.start();
    expect(kit.timer(state, T0 + 1)).toBe(state);
    expect(
      kit.reduce(state, { type: 'timer', now: T0 + TICK_MS, phaseId: 'score', startedAt: T0 }),
    ).toBe(state);
    expect(
      kit.reduce(state, { type: 'timer', now: T0 + TICK_MS, phaseId: 'play', startedAt: T0 - 1 }),
    ).toBe(state);
    expect(kit.input(state, 'p1', { type: 'hop', dir: 'up' }, T0 - 1)).toBe(state);
  });

  it('cannot give spectators control or create a score entry for them', () => {
    const state = kit.start();
    for (const id of ['spectator-x', '', '__proto__', 'constructor']) {
      expect(kit.input(state, id, { type: 'hop', dir: 'up' }, T0 + 100)).toBe(state);
      expect(game.controllerView(state, id).me.role).toBe('spectator');
      expect(game.bot.sampleInput(state, id, createRng(14))).toBeNull();
    }
  });

  it('a disconnected racer can reconnect in place, while the clock ends without waiting', () => {
    let state = kit.input(kit.start(), 'p1', { type: 'hop', dir: 'up' }, T0 + 100);
    const before = state.world.runners.find((r) => r.id === 'p1');
    state = kit.player(state, 'p1', false, undefined, T0 + 200);
    state = kit.player(state, 'p1', true, undefined, T0 + 300);
    expect(state.world.runners.find((r) => r.id === 'p1')).toEqual(before);
    for (const id of Object.keys(state.players))
      state = kit.player(state, id, false, undefined, T0 + 400);
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    state = kit.timer(state);
    expect(state.phase.id).toBe('done');
    expect(Object.keys(game.results(state)!.scores)).toHaveLength(4);
  });

  it('holds all simulation clocks while paused and shifts absolute time on resume', () => {
    let state = kit.timer(kit.start(), T0 + 1000);
    const before = state;
    state = kit.vip(state, 'pause', T0 + 1000);
    expect(state.phase.paused).toEqual({ at: T0 + 1000 });
    const paused = state;
    expect(kit.timer(state, T0 + 5000)).toBe(state);
    expect(kit.input(state, 'p1', { type: 'hop', dir: 'up' }, T0 + 5000)).toBe(state);
    state = kit.vip(state, 'resume', T0 + 6000);
    expect(state.phase.paused).toBeUndefined();
    expect(state.endsAt).toBe(before.endsAt + 5000);
    expect(state.began).toBe(before.began + 5000);
    expect(state.phase.deadline).toBe(paused.phase.deadline! + 5000);
    expect(state.world).toEqual(before.world);
    expect(state.checked).toBe(before.checked);
  });

  it('the cap reveals highest-row scores once, then results close after the score hold', () => {
    let state = kit.start();
    state = {
      ...state,
      world: {
        ...state.world,
        runners: state.world.runners.map((r, i) => ({ ...r, maxRow: [7, 7, 3, 0][i]! })),
      },
    };
    expect(game.results(state)).toBeNull();
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    expect(state.checked).toBe(ROUND_MS);
    expect(state.scores).toEqual({ p1: 7, p2: 7, p3: 3, p4: 0 });
    expect(state.phase.deadline).toBe(state.phase.startedAt + SCORE_MS);
    expect(game.results(state)).toBeNull();
    const score = state;
    state = kit.timer(state);
    expect(state.phase.id).toBe('done');
    expect(state.scores).toEqual(score.scores);
    expect(game.results(state)?.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(game.results(state)?.ranking.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
    expect(kit.timer(state)).toBe(state);
  });

  it('VIP skip traverses play, score and done; VIP end preserves highest rows immediately', () => {
    let state = kit.input(kit.start(), 'p1', { type: 'hop', dir: 'up' }, T0 + 100);
    const end = kit.vip(state, 'end', T0 + 200);
    expect(end.phase.id).toBe('done');
    expect(game.results(end)?.scores['p1']).toBe(1);
    state = kit.vip(state, 'skip', T0 + 200);
    expect(state.phase.id).toBe('score');
    state = kit.vip(state, 'skip', T0 + 300);
    expect(state.phase.id).toBe('done');
  });

  it('sends public stage geometry without RNG or future map generation details', () => {
    const state = kit.start();
    const tv = game.tvView(state);
    const a = game.controllerView(state, 'p1');
    const b = game.controllerView(state, 'p2');
    const spectator = game.controllerView(state, 'spectator-x');
    for (const view of [tv, a, b, spectator]) {
      expect(JSON.stringify(view)).not.toContain('"rng"');
      expect(view.map.lanes.length).toBeLessThan(ROWS);
      expect(view.map.lanes.every((lane) => lane.offset === 0)).toBe(true);
    }
    expect(a.map).toEqual(b.map);
    expect(a.runners).toEqual(b.runners);
    expect(spectator.map).toEqual(tv.map);
    expect(a.me.id).toBe('p1');
    expect(b.me.id).toBe('p2');
    const unused = structuredClone(state);
    unused.rng = seedRng(999);
    unused.world.lanes[ROWS - 1]!.offset = 12345;
    expect(game.tvView(unused)).toEqual(tv);
    expect(game.controllerView(unused, 'p1')).toEqual(a);
  });

  it('has three real, valid bot strengths and no bot input in reveal or results', () => {
    const state = kit.start();
    const outcomes = new Set<string>();
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const input = game.bot.sampleInput(state, 'p1', createRng(seed), skill);
        if (input !== null) expect(game.inputSchema.safeParse(input).success).toBe(true);
        outcomes.add(JSON.stringify(input));
      }
    }
    expect(outcomes.size).toBeGreaterThan(1);
    expect(game.bot.sampleInput(kit.vip(state, 'skip'), 'p1', createRng(14))).toBeNull();
    expect(game.bot.sampleInput(kit.vip(state, 'end'), 'p1', createRng(14))).toBeNull();
  });
});
