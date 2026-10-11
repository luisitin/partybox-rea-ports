// Semantic rules and hostile event sequences, independent of the rendered arena.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { finishGame, jsonSize, testKit, testPlayers } from '@partybox/game-sdk/testing';
import { botInput } from './bot';
import { segmentDistance2 } from './geometry';
import { game } from './index';
import { WAKE_MS } from './phases/play';
import { roundPoints } from './scoring';
import {
  BOOST_COST,
  BOOST_SPEED,
  FOOD_COUNT,
  GRACE_MS,
  MAX_FOOD,
  MAX_MASS,
  MIN_MASS,
  RADIUS,
  RESPAWN_MS,
  SCORE_MS,
  SPEED,
  START_MASS,
  STEP_MS,
  TURN_RATE,
  W,
  inputSchema,
} from './types';
import type { Food, Point, Snake, World } from './types';
import { makeWorld, move, tick } from './world';

const rng = seedRng(7);
const snake = (id = 'a', extra: Partial<Snake> = {}): Snake => ({
  id,
  body: [[80, 50]],
  angle: 0,
  target: 0,
  boost: false,
  mass: START_MASS,
  respawnAt: null,
  safeUntil: 0,
  crashes: 0,
  ...extra,
});
const food = (): Food[] => Array.from({ length: FOOD_COUNT }, () => ({ x: 10, y: 10, value: 1 }));
const world = (...snakes: Snake[]): World => ({ snakes, food: food(), elapsed: 0 });
const run = (w: World, to = STEP_MS, connected = {}): World => tick(w, rng, to, connected)[0];
const kit = testKit(game, { players: testPlayers(2), settings: { rounds: 1 }, inputAt: 0 });
const input = (angle: number, boost = false) => ({ type: 'steer' as const, angle, boost });
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

describe('movement and the price of a lunge', () => {
  it('moves one normal step without spending mass or mutating the snake', () => {
    const s = freeze(snake());
    const moved = move(s);
    expect(moved.body[0]).toEqual([80 + (SPEED * STEP_MS) / 1000, 50]);
    expect(moved.mass).toBe(START_MASS);
    expect(s.body).toEqual([[80, 50]]);
  });
  it('boost moves faster and spends the documented mass each step', () => {
    const moved = move(snake('a', { boost: true }));
    expect(moved.body[0]?.[0]).toBe(80 + (BOOST_SPEED * STEP_MS) / 1000);
    expect(moved.mass).toBeCloseTo(START_MASS - BOOST_COST, 3);
  });
  it('cannot boost or spend mass at the minimum', () => {
    const moved = move(snake('a', { boost: true, mass: MIN_MASS }));
    expect(moved.mass).toBe(MIN_MASS);
    expect(moved.body[0]?.[0]).toBe(80 + (SPEED * STEP_MS) / 1000);
  });
  it('never overspends when the last lunge reaches the minimum', () => {
    expect(move(snake('a', { boost: true, mass: MIN_MASS + 0.1 })).mass).toBe(MIN_MASS);
  });
  it('returns spent boost mass as food behind the snake', () => {
    const s = snake('a', {
      body: [
        [80, 50],
        [70, 50],
      ],
      boost: true,
    });
    const moved = run(world(s));
    expect(moved.food).toContainEqual({ x: 70, y: 50, value: BOOST_COST });
    expect(moved.food).toHaveLength(FOOD_COUNT + 1);
  });
  it('emits only the mass actually spent when boost reaches the minimum', () => {
    const s = snake('a', { boost: true, mass: MIN_MASS + 0.1 });
    const after = run(world(s));
    const spent = s.mass - after.snakes[0]!.mass;
    expect(after.food.slice(FOOD_COUNT).reduce((sum, f) => sum + f.value, 0)).toBeCloseTo(spent, 3);
  });
  it('turns at a bounded rate and takes the short route across the angle seam', () => {
    expect(move(snake('a', { target: Math.PI / 2 })).angle).toBeCloseTo(
      (TURN_RATE * STEP_MS) / 1000,
    );
    const seam = move(snake('a', { angle: Math.PI - 0.1, target: -Math.PI + 0.1 }));
    expect(seam.angle).toBeCloseTo(-Math.PI + 0.1);
  });
  it('bounds the body even after repeated movement at maximum mass', () => {
    const body = Array.from({ length: MAX_MASS + 20 }, (_, i): Point => [80 - i / 10, 50]);
    expect(move(snake('a', { mass: MAX_MASS, body })).body).toHaveLength(MAX_MASS);
  });
});
describe('simultaneous crashes and return', () => {
  it('a wall kills even during spawn protection', () => {
    const s = run(world(snake('a', { body: [[W - RADIUS - 0.1, 50]], safeUntil: GRACE_MS })));
    expect(s.snakes[0]?.respawnAt).toBe(STEP_MS + RESPAWN_MS);
    expect(s.snakes[0]?.body).toEqual([]);
    expect(s.snakes[0]?.mass).toBe(MIN_MASS);
  });
  it('hitting another body kills the attacker and leaves its owner alive', () => {
    const a = snake('a', { body: [[77, 50]] });
    const b = snake('b', {
      body: [
        [80, 70],
        [80, 50],
        [80, 30],
      ],
      angle: Math.PI / 2,
      target: Math.PI / 2,
    });
    const s = run(world(a, b));
    expect(s.snakes.map((x) => x.respawnAt !== null)).toEqual([true, false]);
  });
  it('crossing your own body is safe', () => {
    const body: Point[] = [
      [80, 50],
      [85, 50],
      [85, 45],
      [80, 45],
      [80, 55],
    ];
    expect(run(world(snake('a', { body }))).snakes[0]?.respawnAt).toBeNull();
  });
  it('head-on contact kills both heads regardless of size', () => {
    const a = snake('a', { body: [[78, 50]], mass: MAX_MASS });
    const b = snake('b', { body: [[82, 50]], angle: Math.PI, target: Math.PI, mass: MIN_MASS });
    expect(run(world(a, b)).snakes.map((s) => s.respawnAt !== null)).toEqual([true, true]);
    expect(run(world(b, a)).snakes.map((s) => s.respawnAt !== null)).toEqual([true, true]);
  });
  it('swept trajectories detect a crossing with both endpoints beyond the collision radius', () => {
    expect(segmentDistance2([0, 0], [10, 0], [5, -10], [5, 10])).toBe(0);
    expect(segmentDistance2([0, 0], [10, 0], [5, 8], [5, 10])).toBe(64);
  });
  it('protected snakes can pass through other snakes during the return grace period', () => {
    const a = snake('a', { body: [[78, 50]], safeUntil: GRACE_MS });
    const b = snake('b', {
      body: [[82, 50]],
      angle: Math.PI,
      target: Math.PI,
      safeUntil: GRACE_MS,
    });
    expect(run(world(a, b)).snakes.every((s) => s.respawnAt === null)).toBe(true);
  });
  it('a corpse becomes food once, not again on subsequent dead steps', () => {
    const start = world(
      snake('a', {
        body: [
          [157, 50],
          [155, 50],
          [153, 50],
          [151, 50],
        ],
      }),
    );
    const first = run(start);
    expect(first.food.length).toBeGreaterThan(FOOD_COUNT);
    expect(first.snakes[0]?.crashes).toBe(1);
    const second = run(first, STEP_MS * 2);
    expect(second.food).toEqual(first.food);
    expect(second.snakes[0]?.crashes).toBe(1);
  });
  it('returns at the two-second deadline with fresh mass and grace', () => {
    const dead = run(world(snake('a', { body: [[157, 50]] })));
    expect(run(dead, RESPAWN_MS).snakes[0]?.respawnAt).not.toBeNull();
    const back = run(dead, RESPAWN_MS + STEP_MS).snakes[0]!;
    expect(back.respawnAt).toBeNull();
    expect(back.mass).toBe(START_MASS);
    expect(back.safeUntil).toBe(RESPAWN_MS + STEP_MS + GRACE_MS);
    expect(back.crashes).toBe(1);
  });
  it('a disconnected dead snake waits offstage, then returns after reconnect', () => {
    const dead = run(world(snake('a', { body: [[157, 50]] })));
    const absent = run(dead, RESPAWN_MS + STEP_MS, { a: false });
    expect(absent.snakes[0]?.respawnAt).not.toBeNull();
    expect(run(absent, RESPAWN_MS + STEP_MS * 2, { a: true }).snakes[0]?.respawnAt).toBeNull();
  });
});
describe('food, growth and a deterministic bounded arena', () => {
  it('eating adds food value to current mass and removes that food', () => {
    const w = world(snake());
    w.food.push({ x: 81.6, y: 50, value: 4 });
    const s = run(w);
    expect(s.snakes[0]?.mass).toBe(START_MASS + 4);
    expect(s.food).toHaveLength(FOOD_COUNT);
    expect(s.food).not.toContainEqual({ x: 81.6, y: 50, value: 4 });
  });
  it('caps growth at maximum mass', () => {
    const w = world(snake('a', { mass: MAX_MASS - 1 }));
    w.food.push({ x: 81.6, y: 50, value: 100 });
    expect(run(w).snakes[0]?.mass).toBe(MAX_MASS);
  });
  it('equal-distance eaters share food without a seat-order advantage', () => {
    const a = snake('a', { body: [[78.4, 48]], safeUntil: GRACE_MS });
    const b = snake('b', { body: [[78.4, 52]], safeUntil: GRACE_MS });
    for (const snakes of [
      [a, b],
      [b, a],
    ]) {
      const w = world(...snakes);
      w.food.push({ x: 80, y: 50, value: 4 });
      expect(run(w).snakes.map((s) => s.mass)).toEqual([START_MASS + 2, START_MASS + 2]);
    }
  });
  it('keeps food bounded after many corpses and boost sparks', () => {
    const w = world(snake());
    w.food = Array.from({ length: MAX_FOOD + 20 }, () => ({ x: 10, y: 10, value: 1 }));
    expect(run(w).food).toHaveLength(MAX_FOOD);
  });
  it('advancing in pieces gives the same arena and RNG as one large advance', () => {
    const start = world(snake('a', { boost: true }));
    const [part, r] = tick(start, rng, 350, {});
    expect(tick(part, r, 900, {})).toEqual(tick(start, rng, 900, {}));
  });
  it('duplicate and regressive advances preserve the exact state and RNG', () => {
    const [s, r] = tick(world(snake()), rng, 500, {});
    for (const at of [500, 450, 0]) {
      const [again, nextRng] = tick(s, r, at, {});
      expect(again).toBe(s);
      expect(nextRng).toBe(r);
    }
  });
  it('does not mutate frozen arena, body, food, RNG or connection inputs', () => {
    const w = freeze(world(snake('a', { boost: true })));
    const before = JSON.stringify(w);
    tick(w, freeze(seedRng(7)), 500, freeze({ a: true }));
    expect(JSON.stringify(w)).toBe(before);
  });
  it('spawns reproducibly and stays comfortably below the public-view byte budget', () => {
    const ids = testPlayers(8).map((p) => p.id);
    expect(makeWorld(ids, rng)).toEqual(makeWorld(ids, rng));
    const body = Array<Point>(MAX_MASS).fill([150.123, 80.456]);
    const w = world(...ids.map((id) => snake(id, { mass: MAX_MASS, body })));
    w.food = Array.from({ length: MAX_FOOD }, () => ({ x: 150.123, y: 80.456, value: 3.123 }));
    expect(jsonSize(w)).toBeLessThan(64 * 1024);
  });
});

describe('match controls, scoring and hostile senders', () => {
  it('scores floor of current mass, including dead minimums', () => {
    expect(
      roundPoints(
        world(snake('a', { mass: 19.9 }), snake('b', { mass: MIN_MASS, respawnAt: 1000 })),
      ),
    ).toEqual({ a: 19, b: MIN_MASS });
  });
  it('the round cap banks points exactly once even with a repeated timer', () => {
    const start = kit.start();
    expect(start.phase.deadline).toBe(kit.t0 + WAKE_MS);
    expect(game.tvView(start).deadline).toBe(start.endsAt);
    expect(game.controllerView(start, 'p1').deadline).toBe(start.endsAt);
    const event = {
      type: 'timer' as const,
      now: start.endsAt,
      phaseId: 'play',
      startedAt: start.phase.startedAt,
    };
    const scored = game.reduce(start, event);
    expect(scored.phase.id).toBe('score');
    expect(scored.scores).toEqual(scored.lastPoints);
    expect(scored.phase.deadline).toBe(start.endsAt + SCORE_MS);
    expect(game.reduce(scored, event)).toBe(scored);
    expect(kit.timer(scored).phase.id).toBe('done');
  });
  it('VIP skip banks the current round then skips standings into the next round', () => {
    const start = kit.start({ settings: { rounds: 2 } });
    const scored = kit.vip(start, 'skip', kit.t0);
    expect(scored.phase.id).toBe('score');
    expect(scored.lastPoints).toEqual({ p1: START_MASS, p2: START_MASS });
    const next = kit.vip(scored, 'skip', kit.t0 + 1);
    expect(next.phase.id).toBe('play');
    expect(next.round).toBe(2);
    expect(next.scores).toEqual(scored.scores);
  });
  it('VIP end banks the active round once and terminal scores remain fixed', () => {
    const end = kit.vip(kit.start(), 'end', kit.t0);
    expect(end.phase.id).toBe('done');
    expect(end.scores).toEqual({ p1: START_MASS, p2: START_MASS });
    expect(kit.vip(end, 'end', kit.t0 + 1000).scores).toEqual(end.scores);
  });
  it('pause freezes physics and inputs; resume shifts both round clocks', () => {
    const s = kit.start();
    const held = kit.vip(s, 'pause', kit.t0 + 1000);
    expect(kit.timer(held, kit.t0 + 4000)).toBe(held);
    expect(kit.input(held, 'p1', input(0, true), kit.t0 + 4000)).toBe(held);
    const back = kit.vip(held, 'resume', kit.t0 + 6000);
    expect(back.world).toEqual(held.world);
    expect(back.began).toBe(s.began + 5000);
    expect(back.endsAt).toBe(s.endsAt + 5000);
    expect(back.phase.deadline).toBe(held.phase.deadline! + 5000);
  });
  it('ending a paused round banks its frozen arena without advancing through the pause', () => {
    const held = kit.vip(kit.start(), 'pause', kit.t0 + 1000);
    const end = kit.vip(held, 'end', kit.t0 + 11_000);
    expect(end.world).toEqual(held.world);
    expect(end.scores).toEqual(roundPoints(held.world));
  });
  it('disconnect releases boost, rejects inputs and never prevents the round ending', () => {
    const boosted = kit.input(kit.start(), 'p1', input(0, true), kit.t0);
    const absent = kit.player(boosted, 'p1', false, undefined, kit.t0);
    expect(absent.world.snakes.find((s) => s.id === 'p1')?.boost).toBe(false);
    expect(kit.input(absent, 'p1', input(1), kit.t0)).toBe(absent);
    expect(finishGame(game, absent)?.phase.id).toBe('done');
    expect(kit.player(absent, 'p1', true, undefined, kit.t0).world).toEqual(absent.world);
  });
  it('spectators and prototype ids cannot steer or modify the roster', () => {
    const s = kit.start();
    for (const id of ['spectator', '', '__proto__', 'constructor']) {
      expect(kit.input(s, id, input(0, true), kit.t0)).toBe(s);
      expect(kit.player(s, id, false, undefined, kit.t0)).toBe(s);
      expect(game.controllerView(s, id).me.role).toBe('spectator');
    }
  });
  it('ignores stale, early and wrong-phase timers plus regressive inputs', () => {
    const s = kit.timer(kit.start());
    for (const event of [
      { type: 'timer' as const, now: s.endsAt, phaseId: 'play', startedAt: s.phase.startedAt - 1 },
      { type: 'timer' as const, now: s.endsAt, phaseId: 'nope', startedAt: s.phase.startedAt },
      {
        type: 'timer' as const,
        now: s.phase.deadline! - 1,
        phaseId: 'play',
        startedAt: s.phase.startedAt,
      },
    ])
      expect(game.reduce(s, event)).toBe(s);
    expect(kit.input(s, 'p1', input(0), kit.t0)).toBe(s);
  });
  it('rejects invalid angles, boost types and missing input fields', () => {
    for (const value of [
      input(Infinity),
      input(NaN),
      input(Math.PI + 0.001),
      input(-Math.PI - 0.001),
      { type: 'steer', angle: 0, boost: 1 },
      { type: 'steer', angle: 0 },
    ])
      expect(inputSchema.safeParse(value).success).toBe(false);
    expect(inputSchema.safeParse(input(-Math.PI, true)).success).toBe(true);
    expect(inputSchema.safeParse(input(Math.PI)).success).toBe(true);
  });
  it('ties share first place and complete results include every player', () => {
    const end = kit.vip(kit.start(), 'end', kit.t0);
    const result = game.results(end)!;
    expect(result.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 1]);
    expect(game.results(kit.start())).toBeNull();
  });
});

describe('three useful bot strengths', () => {
  it('sharp bots lunge for valuable food while easy and normal conserve size', () => {
    const w = world(snake('a', { mass: 30 }));
    w.food = [{ x: 105, y: 50, value: 5 }];
    expect(botInput(w, 'a', 'sharp')?.boost).toBe(true);
    expect(botInput(w, 'a', 'easy')?.boost ?? false).toBe(false);
    expect(botInput(w, 'a', 'normal')?.boost ?? false).toBe(false);
  });
  it('bots avoid a wall, produce schema-valid headings and stop repeating unchanged controls', () => {
    const w = world(snake('a', { body: [[155, 50]] }));
    w.food = [{ x: 158, y: 50, value: 1 }];
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const choice = botInput(w, 'a', skill)!;
      expect(choice).not.toBeNull();
      expect(Math.cos(choice.angle)).toBeLessThan(0);
      expect(inputSchema.safeParse(choice).success).toBe(true);
      const matched = world(
        snake('a', { target: choice.angle, body: [[155, 50]], boost: choice.boost }),
      );
      matched.food = w.food;
      expect(botInput(matched, 'a', skill)).toBeNull();
    }
  });
  it('dead, disconnected, unknown and out-of-phase bots do not act', () => {
    expect(botInput(world(snake('a', { body: [], respawnAt: 1000 })), 'a')).toBeNull();
    const start = kit.start();
    const rngForBot = createRng(3);
    expect(game.bot.sampleInput(start, 'ghost', rngForBot)).toBeNull();
    expect(
      game.bot.sampleInput(kit.player(start, 'p1', false, undefined, kit.t0), 'p1', rngForBot),
    ).toBeNull();
    expect(game.bot.sampleInput(kit.vip(start, 'skip', kit.t0), 'p1', rngForBot)).toBeNull();
  });
});
