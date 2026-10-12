import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { PROP_RULES } from '../server/content';
import { HEIGHT, RECYCLE_MS, ROUND_MS, WIDTH } from '../server/types';
import { applyMove, makeWorld, radiusOf, speedOf, tick } from '../server/world';
import { freeze, hole, prop, world } from './helpers';

describe('city growth and motion', () => {
  it('pins discrete port growth and slower large holes without one-bin car access', () => {
    expect(radiusOf(0)).toBe(2.2);
    expect(radiusOf(9)).toBe(2.2);
    expect(radiusOf(10)).toBe(3.3);
    expect(radiusOf(100)).toBe(7.8);
    expect(radiusOf(1000)).toBe(14);
    expect(speedOf(0)).toBe(19);
    expect(speedOf(100)).toBeCloseTo(16.2);
    expect(speedOf(1000)).toBeCloseTo(13.4);
  });
  it('normalizes diagonal steering without increasing travel speed; release stops', () => {
    const base = world([hole()]);
    const cardinal = tick(applyMove(base, 'p1', { type: 'move', x: 1, y: 0 }), 1000).holes[0]!;
    const diagonal = tick(applyMove(base, 'p1', { type: 'move', x: 1, y: 1 }), 1000).holes[0]!;
    expect(cardinal.x - 50).toBeCloseTo(19, 3);
    expect(Math.hypot(diagonal.x - 50, diagonal.y - 50)).toBeCloseTo(19, 2);
    const moved = tick(applyMove(base, 'p1', { type: 'move', x: 1, y: 0 }), 200);
    const stopped = tick(applyMove(moved, 'p1', { type: 'move', x: 0, y: 0 }), 2000);
    expect(stopped.holes[0]!.x).toBe(moved.holes[0]!.x);
  });
  it('keeps the entire rim inside every boundary', () => {
    for (const direction of [-1, 1]) {
      const h = tick(world([hole('p1', { dx: direction, dy: direction, mass: 100 })]), ROUND_MS)
        .holes[0]!;
      expect(h.x).toBe(direction < 0 ? 7.8 : WIDTH - 7.8);
      expect(h.y).toBe(direction < 0 ? 7.8 : HEIGHT - 7.8);
    }
  });
  it('judges at fixed 100 ms steps, caps the round and is chunk invariant', () => {
    const base = freeze(world([hole('p1', { dx: 0.6, dy: 0.8 })], [prop({ x: 52 })]));
    const saved = JSON.stringify(base);
    expect(tick(base, 99)).toBe(base);
    const whole = tick(base, 1537);
    expect(whole.elapsed).toBe(1500);
    expect(tick(tick(tick(base, 237), 619), 1537)).toEqual(whole);
    expect(tick(whole, 1200)).toBe(whole);
    expect(tick(base, ROUND_MS + 10_000).elapsed).toBe(90_000);
    expect(JSON.stringify(base)).toBe(saved);
  });
  it('uses an equal resource budget in eight seeded districts and distinct safe spawns', () => {
    const [a, rng] = makeWorld(
      seedRng(42),
      Array.from({ length: 8 }, (_, i) => `p${i}`),
    );
    const [b] = makeWorld(
      seedRng(42),
      a.holes.map((h) => h.id),
    );
    expect(a).toEqual(b);
    expect(rng.step).toBeGreaterThan(0);
    expect(a.props).toHaveLength(592);
    expect(new Set(a.holes.map((h) => `${h.x},${h.y}`)).size).toBe(8);
    expect(a.holes.every((h) => h.immuneUntil === 2000)).toBe(true);
    expect(a.props.filter((p) => p.kind === 'tower')).toHaveLength(24);
  });
});

describe('swallowing city objects', () => {
  it.each(Object.entries(PROP_RULES))(
    'credits the %s intake in score and growth exactly once',
    (kind, rule) => {
      const p = prop({ kind: kind as keyof typeof PROP_RULES, ...rule });
      const first = tick(world([hole('p1', { mass: 200 })], [p]), 100);
      expect(first.holes[0]!.score).toBe(rule.points);
      expect(first.holes[0]!.mass).toBe(200 + rule.points);
      expect(first.holes[0]!.lastGain).toBe(rule.points);
      expect(first.holes[0]!.gainAt).toBe(100);
      expect(tick(first, 200).holes[0]!.score).toBe(rule.points);
    },
  );
  it('requires a strictly wider rim and enough footprint overlap', () => {
    const tower = prop({ kind: 'tower', ...PROP_RULES.tower });
    expect(tick(world([hole('p1', { mass: 164 })], [tower]), 100).holes[0]!.score).toBe(0);
    expect(tick(world([hole('p1', { mass: 165 })], [tower]), 100).holes[0]!.score).toBe(
      PROP_RULES.tower.points,
    );
    expect(tick(world([hole()], [prop({ x: 51.69 })]), 100).holes[0]!.score).toBe(2);
    expect(tick(world([hole()], [prop({ x: 51.71 })]), 100).holes[0]!.score).toBe(0);
  });
  it('recycles small props after twenty seconds and never recycles buildings', () => {
    const first = tick(
      world(
        [hole('p1', { mass: 165 })],
        [prop(), prop({ id: 1, kind: 'tower', radius: 10, points: 60 })],
      ),
      100,
    );
    expect(first.props[0]!.availableAt).toBe(100 + RECYCLE_MS);
    expect(first.props[1]!.availableAt).toBe(ROUND_MS + 1);
    expect(tick(first, 20_000).holes[0]!.score).toBe(62);
    expect(tick(first, 20_100).holes[0]!.score).toBe(64);
  });
  it('a contested prop goes once to the nearest hole, independently of array order', () => {
    const a = hole('p1', { x: 51 });
    const b = hole('p2', { slot: 1, x: 50 });
    expect(tick(world([a, b], [prop()]), 100).holes.map((h) => h.score)).toEqual([0, 2]);
    const reverse = tick(world([b, a], [prop()]), 100);
    expect(reverse.holes.find((h) => h.id === 'p2')!.score).toBe(2);
  });
  it('exact ties rotate the priority across seats instead of permanently favouring seat zero', () => {
    const tied = [hole('p1'), hole('p2', { slot: 1 })];
    const a = tick(world(tied, [prop()]), 100);
    const b = tick(world(tied, [prop({ id: 1 })]), 100);
    expect(a.holes.map((h) => h.score)).toEqual([0, 2]);
    expect(b.holes.map((h) => h.score)).toEqual([2, 0]);
  });
});

describe('predation and permanent elimination', () => {
  it('requires 25 percent wider size; equal holes cannot swallow each other', () => {
    expect(tick(world([hole(), hole('p2', { slot: 1 })]), 100).holes.every((h) => h.alive)).toBe(
      true,
    );
    expect(
      tick(world([hole('p1', { mass: 9 }), hole('p2', { slot: 1 })]), 100).holes[1]!.alive,
    ).toBe(true);
    expect(
      tick(world([hole('p1', { mass: 10 }), hole('p2', { slot: 1 })]), 100).holes[1]!.alive,
    ).toBe(false);
  });
  it('credits the hunter once and permanently retains the swallowed victim’s bank and growth', () => {
    const base = freeze(
      world([hole('p1', { mass: 100 }), hole('p2', { slot: 1, mass: 10, score: 37, dx: 1 })]),
    );
    const eaten = tick(base, 100);
    expect(eaten.holes[0]!.score).toBe(15);
    expect(eaten.holes[0]!.mass).toBe(115);
    expect(eaten.holes[0]!.swallowed).toBe(1);
    expect(eaten.holes[1]).toMatchObject({
      mass: 10,
      score: 37,
      alive: false,
      eliminatedAt: 100,
      eliminatedBy: 'p1',
      dx: 0,
      dy: 0,
      respawnAt: null,
    });
    expect(applyMove(eaten, 'p2', { type: 'move', x: 1, y: 1 })).toBe(eaten);
    const final = tick(eaten, ROUND_MS);
    expect(final.holes[1]).toEqual(eaten.holes[1]);
    expect(final.holes[0]!.swallowed).toBe(1);
    expect(final.holes[0]!.score).toBe(15);
  });
  it('a shield prevents both eating and being eaten and expires on its exact tick', () => {
    const defended = world([hole('p1', { mass: 100 }), hole('p2', { slot: 1, immuneUntil: 200 })]);
    expect(tick(defended, 100).holes[1]!.alive).toBe(true);
    expect(tick(defended, 200).holes[1]).toMatchObject({ alive: false, eliminatedAt: 200 });
    const protectedHunter = world([
      hole('p1', { mass: 100, immuneUntil: 200 }),
      hole('p2', { slot: 1 }),
    ]);
    expect(tick(protectedHunter, 100).holes[1]!.alive).toBe(true);
  });
  it('resolves a simultaneous swarm largest first, so an eaten hole cannot eat another', () => {
    const swarm = tick(
      world([
        hole('large', { mass: 200 }),
        hole('middle', { slot: 1, mass: 50 }),
        hole('small', { slot: 2 }),
      ]),
      100,
    );
    expect(swarm.holes[0]).toMatchObject({ score: 45, mass: 245, swallowed: 2 });
    expect(swarm.holes[1]).toMatchObject({
      score: 0,
      swallowed: 0,
      alive: false,
      eliminatedBy: 'large',
    });
    expect(swarm.holes[2]).toMatchObject({ alive: false, eliminatedAt: 100 });
  });
});
