import { createRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { freeze, hole, move, prop, start, timer, T0, world } from './helpers';

describe('public stage and personal phone payloads', () => {
  it('always supplies the shared city and own hole, and never simulation bookkeeping', () => {
    const s = move(start(8), 'p1', 0.6, 0.8);
    const tv = game.tvView(s);
    const p1 = game.controllerView(s, 'p1');
    const p2 = game.controllerView(s, 'p2');
    expect(tv.city.holes).toHaveLength(8);
    expect(p1.city).toEqual(tv.city);
    expect(p2.city).toEqual(tv.city);
    expect(p1.stage).toBe(false);
    expect(p1.participating).toBe(true);
    expect(p1.mine!.id).toBe('p1');
    expect(p2.mine!.id).toBe('p2');
    expect(p1.scores).toEqual(p2.scores);
    for (const view of [tv, p1, p2]) {
      expect(JSON.parse(JSON.stringify(view))).toEqual(view);
      expect(JSON.stringify(view)).not.toMatch(
        /"(rng|cells|mass|dx|dy|inputAt|lastMoveAt|immuneUntil|respawnAt)":/,
      );
      expect(Buffer.byteLength(JSON.stringify(view))).toBeLessThan(128 * 1024);
    }
  });
  it('phone-only and remote players get the same public city as the TV, and spectators get a stage', () => {
    const local = start(8, 7, true);
    expect(game.controllerView(local, 'p1').city).toEqual(game.tvView(local).city);
    expect(game.controllerView(local, 'p2').city).toEqual(game.controllerView(local, 'p1').city);
    const spectator = game.controllerView(local, 'spectator');
    expect(spectator.stage).toBe(true);
    expect(spectator.mine).toBeNull();
    expect(spectator.me.role).toBe('spectator');
    const s = start();
    const remote = {
      ...s,
      players: { ...s.players, p1: { ...s.players['p1']!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'p1').city).toEqual(game.tvView(remote).city);
    expect(game.controllerView(remote, 'p2').city).toEqual(game.tvView(remote).city);
    expect(game.controllerView(remote, 'p2').stage).toBe(false);
  });
  it('publishes recent prop sinks and permanent loss without a comeback, then expires gain feedback', () => {
    const base = {
      ...start(),
      world: world(
        [
          hole(),
          hole('p2', { slot: 1, x: 120, alive: false, eliminatedAt: 100, eliminatedBy: 'p1' }),
        ],
        [prop()],
      ),
    };
    const s = timer(base, T0 + 200);
    expect(game.tvView(s).city.props).toHaveLength(0);
    expect(game.controllerView(s, 'p1').mine!.lastGain).toBe(2);
    expect(game.tvView(s).city.sinks).toMatchObject([{ id: 0, by: 'p1', consumedAt: 100 }]);
    expect(game.controllerView(s, 'p2').mine).toMatchObject({ alive: false, respawnIn: 0 });
    expect(game.controllerView(s, 'p2').participating).toBe(false);
    expect(game.controllerView(s, 'p2').stage).toBe(true);
    const later = timer(s, T0 + 1200);
    expect(game.controllerView(later, 'p1').mine!.lastGain).toBe(0);
    const stillOut = timer(later, T0 + 3200);
    expect(game.controllerView(stillOut, 'p2').mine).toMatchObject({
      alive: false,
      respawnIn: 0,
      shield: false,
    });
    expect(game.tvView(stillOut).city.sinks).toEqual([]);
  });
});

describe('three honest bot strengths', () => {
  it.each(['easy', 'normal', 'sharp'] as const)(
    '%s emits finite, normalized, legal inputs and never mutates state',
    (skill) => {
      const s = freeze(start(8));
      const before = JSON.stringify(s);
      const inputs = s.world.holes.map((h) => game.bot.sampleInput(s, h.id, createRng(42), skill));
      expect(
        inputs.every((input) => input !== null && game.inputSchema.safeParse(input).success),
      ).toBe(true);
      for (const input of inputs)
        expect(Math.hypot(input!.x, input!.y)).toBeLessThanOrEqual(1.000001);
      expect(new Set(inputs.map((input) => JSON.stringify(input))).size).toBeGreaterThan(1);
      expect(JSON.stringify(s)).toBe(before);
    },
  );
  it('easy farms nearby props, while normal and sharp flee a larger approaching rim', () => {
    const s = {
      ...start(),
      world: world([hole(), hole('p2', { slot: 1, x: 60, mass: 100 })], [prop({ x: 55 })]),
    };
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'easy')!.x).toBeGreaterThan(0);
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'normal')!.x).toBeLessThan(0);
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'sharp')!.x).toBeLessThan(0);
  });
  it('sharp hunts an edible rival when worthwhile; normal farms, and sharp respects rival shields', () => {
    const s = {
      ...start(),
      world: world([hole('p1', { mass: 100 }), hole('p2', { slot: 1, x: 70 })], [prop({ x: 40 })]),
    };
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'normal')!.x).toBeLessThan(0);
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'sharp')!.x).toBeGreaterThan(0);
    const shielded = {
      ...s,
      world: {
        ...s.world,
        holes: s.world.holes.map((h) => (h.id === 'p2' ? { ...h, immuneUntil: 2000 } : h)),
      },
    };
    expect(game.bot.sampleInput(shielded, 'p1', createRng(1), 'sharp')!.x).toBeLessThan(0);
  });
  it('targets only available edible props and uses no private RNG or victim score information', () => {
    const s = {
      ...start(),
      world: world(
        [hole(), hole('p2', { slot: 1, x: 140 })],
        [
          prop({ x: 40 }),
          prop({ id: 1, x: 55, points: 100, availableAt: 1000 }),
          prop({ id: 2, x: 55, radius: 10, points: 100 }),
        ],
      ),
    };
    const honest = game.bot.sampleInput(s, 'p1', createRng(1), 'normal');
    expect(honest!.x).toBeLessThan(0);
    const altered = {
      ...s,
      rng: { seed: 999, step: 999 },
      world: { ...s.world, holes: s.world.holes.map((h) => ({ ...h, score: 99999 })) },
    };
    expect(game.bot.sampleInput(altered, 'p1', createRng(1), 'normal')).toEqual(honest);
  });
  it('does not act twice on one sample, while paused, disconnected, eliminated, or after play', () => {
    const s = start();
    const sampled = move(s, 'p1', 1, 0);
    expect(game.bot.sampleInput(sampled, 'p1', createRng(1))).toBeNull();
    expect(
      game.bot.sampleInput({ ...s, phase: { ...s.phase, paused: { at: T0 } } }, 'p1', createRng(1)),
    ).toBeNull();
    expect(
      game.bot.sampleInput(
        { ...s, players: { ...s.players, p1: { ...s.players['p1']!, connected: false } } },
        'p1',
        createRng(1),
      ),
    ).toBeNull();
    expect(
      game.bot.sampleInput(
        {
          ...s,
          world: world([hole('p1', { alive: false, eliminatedAt: 100, eliminatedBy: 'p2' })]),
        },
        'p1',
        createRng(1),
      ),
    ).toBeNull();
    expect(game.bot.sampleInput(timer(s, T0 + 90_000), 'p1', createRng(1))).toBeNull();
  });
});
