// Party loss, historical-tier tuning and public sink receipts use production reducers.
import { createRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { DISTRICT_PROPS, PROP_RULES } from '../server/content';
import { game } from '../server/index';
import { MAX_SINKS, ROUND_MS, SINK_MS } from '../server/types';
import { applyMove, growthOf, levelOf, radiusOf, tick } from '../server/world';
import { freeze, hole, move, prop, start, timer, T0, vip, world } from './helpers';

describe('discrete historical growth tuning', () => {
  it('keeps one bin below first growth and cars, then grows exactly at ten points', () => {
    const first = tick(world([hole()], [prop({ ...PROP_RULES.bin })]), 100);
    expect(first.holes[0]!.mass).toBe(1);
    expect(levelOf(first.holes[0]!.mass)).toBe(1);
    expect(radiusOf(first.holes[0]!.mass)).toBeLessThan(PROP_RULES.car.radius);
    const threshold = tick(
      world([hole('p1', { mass: 9, score: 9 })], [prop({ ...PROP_RULES.bin })]),
      100,
    );
    expect(threshold.holes[0]!.mass).toBe(10);
    expect(growthOf(10)).toEqual({ level: 2, levelProgress: 0, nextLevelAt: 27 });
    expect(growthOf(5)).toEqual({ level: 1, levelProgress: 0.5, nextLevelAt: 10 });
    expect(growthOf(9999)).toEqual({ level: 9, levelProgress: 1, nextLevelAt: null });
  });

  it.each([
    ['bench', 9, 10],
    ['car', 26, 27],
    ['house', 81, 82],
    ['tower', 164, 165],
  ] as const)(
    '%s waits for its intended tier instead of continuous square-root growth',
    (kind, before, opens) => {
      const food = prop({ kind, ...PROP_RULES[kind] });
      expect(tick(world([hole('p1', { mass: before })], [food]), 100).holes[0]!.score).toBe(0);
      expect(tick(world([hole('p1', { mass: opens })], [food]), 100).holes[0]!.score).toBe(
        PROP_RULES[kind].points,
      );
    },
  );

  it('provides enough food within every identical district to reach each building gate', () => {
    const total = (kinds: readonly string[]) =>
      DISTRICT_PROPS.filter((kind) => kinds.includes(kind)).reduce(
        (sum, kind) => sum + PROP_RULES[kind].points,
        0,
      );
    expect(DISTRICT_PROPS).toHaveLength(74);
    expect(total(['bin', 'tree'])).toBe(44);
    expect(total(['bin', 'tree', 'bench', 'car'])).toBe(137);
    expect(total(['bin', 'tree', 'bench', 'car', 'house'])).toBe(177);
    expect(total(['bin', 'tree', 'bench', 'car', 'house', 'tower'])).toBe(267);
    expect(levelOf(44)).toBeGreaterThanOrEqual(3);
    expect(levelOf(137)).toBeGreaterThanOrEqual(5);
    expect(levelOf(177)).toBeGreaterThanOrEqual(7);
  });
});

describe('swallowed players stay out of the shared party round', () => {
  it('retains banked points and growth, removes steering, and never respawns or consumes again', () => {
    const base = freeze({
      ...start(),
      world: world([
        hole('p1', { mass: 100, score: 100 }),
        hole('p2', { slot: 1, mass: 10, score: 37, dx: 1 }),
      ]),
    });
    const lost = timer(base, T0 + 200);
    expect(lost.phase.id).toBe('play');
    const victim = lost.world.holes.find((candidate) => candidate.id === 'p2')!;
    expect(victim).toMatchObject({
      alive: false,
      mass: 10,
      score: 37,
      dx: 0,
      dy: 0,
      eliminatedBy: 'p1',
      eliminatedAt: 100,
      respawnAt: null,
    });
    const own = game.controllerView(lost, 'p2');
    expect(own.participating).toBe(false);
    expect(own.stage).toBe(true);
    expect(own.city).toEqual(game.tvView(lost).city);
    expect(own.mine).toMatchObject({ alive: false, growth: 10, score: 37, respawnIn: 0 });
    expect(own.deadline).toBe(T0 + ROUND_MS);
    expect(move(lost, 'p2', -1, 1, T0 + 500)).toBe(lost);
    expect(game.bot.sampleInput(lost, 'p2', createRng(42), 'sharp')).toBeNull();
    const reconnected = game.reduce(lost, {
      type: 'player',
      playerId: 'p2',
      connected: true,
      now: T0 + 500,
    });
    expect(game.controllerView(reconnected, 'p2').participating).toBe(false);
    const last = timer(reconnected, T0 + ROUND_MS - 1);
    expect(last.phase.id).toBe('play');
    expect(last.world.holes.find((candidate) => candidate.id === 'p2')).toEqual(victim);
    const reveal = timer(last, T0 + ROUND_MS);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.scores.p2).toBe(37);
    expect(game.results(timer(reveal))!.scores.p2).toBe(37);
  });

  it('an eliminated body cannot harvest nearby props or hunt a surviving player', () => {
    const dead = hole('p1', {
      mass: 246,
      score: 246,
      alive: false,
      eliminatedBy: 'p2',
      eliminatedAt: 100,
    });
    const base = world([dead, hole('p2', { slot: 1 })], [prop({ ...PROP_RULES.bin })]);
    const next = tick(base, 1000);
    expect(next.holes[0]).toEqual(dead);
    expect(next.holes[1]!.alive).toBe(true);
    expect(next.holes[1]!.score).toBe(PROP_RULES.bin.points);
    expect(next.holes[1]!.swallowed).toBe(0);
    expect(applyMove(next, 'p1', { type: 'move', x: 1, y: 0 })).toBe(next);
  });

  it('permanent departure cannot return, while a temporary disconnect remains a stopped eligible seat', () => {
    const initial = {
      ...start(),
      world: world([hole('p1', { dx: 1, mass: 9, score: 9 }), hole('p2', { slot: 1, x: 120 })]),
    };
    const away = game.reduce(initial, {
      type: 'player',
      playerId: 'p1',
      connected: false,
      now: T0 + 400,
    });
    expect(game.controllerView(away, 'p1')).toMatchObject({ participating: true });
    expect(game.controllerView(away, 'p1').mine).toMatchObject({ alive: true, connected: false });
    const returned = game.reduce(away, {
      type: 'player',
      playerId: 'p1',
      connected: true,
      now: T0 + 500,
    });
    expect(move(returned, 'p1', -1, 0, T0 + 500).world.holes[0]!.dx).toBe(-1);
    const departed = game.reduce(initial, {
      type: 'player',
      playerId: 'p1',
      connected: false,
      gone: 'left',
      now: T0 + 400,
    });
    const permanentlyBack = game.reduce(departed, {
      type: 'player',
      playerId: 'p1',
      connected: true,
      now: T0 + 500,
    });
    expect(permanentlyBack.left).toContain('p1');
    expect(game.controllerView(permanentlyBack, 'p1')).toMatchObject({
      participating: false,
      stage: true,
      mine: { alive: false, left: true, connected: true, score: 9 },
    });
    expect(move(permanentlyBack, 'p1', 1, 0, T0 + 1000)).toBe(permanentlyBack);
    expect(game.bot.sampleInput(permanentlyBack, 'p1', createRng(1))).toBeNull();
  });

  it('the ninety-second shared clock survives one survivor or no survivors, and rank uses banked points', () => {
    let s = {
      ...start(),
      world: world([
        hole('p1', { alive: false, mass: 10, score: 40 }),
        hole('p2', { slot: 1, x: 120, score: 12 }),
      ]),
    };
    expect(timer(s, T0 + 1000).phase.id).toBe('play');
    const ranked = game.results(vip(s, 'end', T0))!;
    expect(ranked.winnerIds).toEqual(['p1']);
    s = game.reduce(s, {
      type: 'player',
      playerId: 'p2',
      connected: false,
      gone: 'left',
      now: T0 + 1000,
    });
    expect(s.world.holes.every((candidate) => !candidate.alive)).toBe(true);
    expect(timer(s, T0 + ROUND_MS - 1).phase.id).toBe('play');
    const done = timer(timer(s, T0 + ROUND_MS));
    expect(game.results(done)!.scores).toEqual({ p1: 40, p2: 12 });
  });
});

describe('fixed-step contention and bounded public sink feedback', () => {
  it('rejects an older input even when both timestamps fall in one physics step', () => {
    const base = {
      ...start(),
      world: world([hole(), hole('p2', { slot: 1, x: 120 })]),
    };
    const newer = move(base, 'p1', 1, 0, T0 + 90);
    expect(newer.world.elapsed).toBe(0);
    expect(move(newer, 'p1', -1, 0, T0 + 80)).toBe(newer);
    expect(move(newer, 'p1', -1, 0, T0 + 95).world.holes[0]!.dx).toBe(-1);
  });

  it('rotates exact ties between surviving contenders despite gaps in dead seat numbers', () => {
    const winners: string[] = [];
    for (let step = 1; step <= 8; step++) {
      const base = world(
        [
          hole('dead', { slot: 0, alive: false }),
          hole('left-survivor', { slot: 2 }),
          hole('right-survivor', { slot: 7 }),
        ],
        [prop({ ...PROP_RULES.bin })],
        (step - 1) * 100,
      );
      const next = tick(base, step * 100);
      winners.push(next.holes.find((candidate) => candidate.score > 0)!.id);
    }
    expect(winners.filter((id) => id === 'left-survivor')).toHaveLength(4);
    expect(winners.filter((id) => id === 'right-survivor')).toHaveLength(4);
  });

  it('keeps at most96 recent prop receipts for700ms and never includes recycle bookkeeping', () => {
    const food = Array.from({ length: 200 }, (_, id) => prop({ id, ...PROP_RULES.bin }));
    const first = tick(world([hole()], food), 100);
    expect(first.sinks).toHaveLength(MAX_SINKS);
    expect(first.sinks[0]?.id).toBe(104);
    expect(first.sinks.every((sink) => sink.by === 'p1' && sink.consumedAt === 100)).toBe(true);
    expect(first.sinks.every((sink) => !Object.hasOwn(sink, 'availableAt'))).toBe(true);
    expect(tick(first, 100 + SINK_MS - 1).sinks).toHaveLength(MAX_SINKS);
    expect(tick(first, 100 + SINK_MS).sinks).toEqual([]);
    expect(tick(tick(first, 400), 800)).toEqual(tick(first, 800));
  });

  it('pause holds recent receipts and shifts the shared absolute clock without changing their age', () => {
    const base = {
      ...start(),
      world: world([hole(), hole('p2', { slot: 1, x: 120 })], [prop({ ...PROP_RULES.bin })]),
    };
    const collected = timer(base, T0 + 200);
    const paused = vip(collected, 'pause', T0 + 200);
    const resumed = vip(paused, 'resume', T0 + 5200);
    expect(resumed.world).toEqual(paused.world);
    expect(resumed.endsAt).toBe(T0 + ROUND_MS + 5000);
    expect(game.tvView(resumed).city.sinks[0]?.consumedAt).toBe(100);
    expect(game.controllerView(resumed, 'p1').elapsed).toBe(200);
    expect(game.tvView(timer(resumed, T0 + 5800)).city.sinks).toEqual([]);
  });
});
