import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { makeWorld } from '../server/content';
import { roundPoints } from '../server/scoring';
import { BOUNCE, GRAVITY, SPEED, SPRING, STEP_MS, W } from '../server/types';
import type { Climber, Platform, World } from '../server/types';
import { apply, deltaX, lands, tick, wrap } from '../server/world';

const climber = (extra: Partial<Climber> = {}): Climber => ({
  id: 'p1',
  x: 120,
  y: 80,
  vy: -100,
  dir: 0,
  peak: 100,
  camera: 0,
  died: null,
  bounces: 0,
  ...extra,
});
const platform = (extra: Partial<Platform> = {}): Platform => ({
  id: 1,
  x: 120,
  y: 79,
  width: 50,
  kind: 'normal',
  ...extra,
});
const world = (c = climber(), platforms: Platform[] = []): World => ({
  climbers: [c],
  platforms,
  stepped: 0,
});

describe('Doodle Climb physics', () => {
  it('uses a continuous cylindrical horizontal world', () => {
    expect(wrap(-1)).toBe(W - 1);
    expect(wrap(W + 1)).toBe(1);
    expect(deltaX(238, 2)).toBe(4);
    expect(deltaX(2, 238)).toBe(-4);
    expect(lands(238, platform({ x: 2, width: 4 }))).toBe(true);
    expect(lands(120, platform({ x: 170, width: 50 }))).toBe(false);
    expect(lands(153, platform({ width: 50 }))).toBe(true);
    expect(lands(153.01, platform({ width: 50 }))).toBe(false);
  });

  it('integrates gravity and held steering in fixed samples', () => {
    const c = tick(world(climber({ vy: 200, dir: 1 })), STEP_MS).climbers[0]!;
    expect(c.vy).toBe(200 - (GRAVITY * STEP_MS) / 1000);
    expect(c.x).toBe(120 + (SPEED * STEP_MS) / 1000);
    expect(c.y).toBeCloseTo(80 + ((200 + c.vy) * STEP_MS) / 2000, 6);
    expect(tick(world(climber({ x: 239, dir: 1 })), STEP_MS).climbers[0]!.x).toBe(2);
    expect(tick(world(climber({ x: 1, dir: -1 })), STEP_MS).climbers[0]!.x).toBe(238);
  });

  it('lands while descending, choosing the highest crossed surface', () => {
    const w = tick(
      world(climber({ vy: -200 }), [platform({ y: 77 }), platform({ y: 79 })]),
      STEP_MS,
    );
    expect(w.climbers[0]).toMatchObject({ y: 79, vy: BOUNCE, bounces: 1, died: null });
    const missed = tick(world(climber({ x: 10 }), [platform()]), STEP_MS);
    expect(missed.climbers[0]!.bounces).toBe(0);
    const rising = tick(world(climber({ vy: 100 }), [platform({ y: 81 })]), STEP_MS);
    expect(rising.climbers[0]!.bounces).toBe(0);
  });

  it('gives a spring a greater launch and checks the wrapped crossing position', () => {
    expect(tick(world(climber(), [platform({ kind: 'spring' })]), STEP_MS).climbers[0]!.vy).toBe(
      SPRING,
    );
    const edge = world(climber({ x: 239, dir: 1 }), [platform({ x: 2, width: 4 })]);
    expect(tick(edge, STEP_MS).climbers[0]!.bounces).toBe(1);
  });

  it('raises the camera with the peak, falls below it once, and freezes a lost run', () => {
    const raised = tick(world(climber({ y: 300, peak: 300, vy: 100 })), STEP_MS).climbers[0]!;
    expect(raised.peak).toBe(raised.y);
    expect(raised.camera).toBeCloseTo(raised.peak - 180, 6);
    const lost = tick(world(climber({ y: 99, peak: 300, camera: 120, vy: -200 })), STEP_MS);
    expect(lost.climbers[0]!.died).toBe(STEP_MS);
    expect(tick(lost, 1000).climbers[0]).toBe(lost.climbers[0]);
    expect(apply(lost, 'p1', { type: 'steer', dir: 1 })).toBe(lost);
  });

  it('is identical with chunked delivery and ignores already sampled time', () => {
    const start = world(climber({ y: 0, peak: 0, vy: BOUNCE }), [platform({ y: 0, width: W })]);
    const once = tick(start, 3000);
    expect(tick(tick(tick(start, 733), 1489), 3000)).toEqual(once);
    expect(tick(once, 3000)).toBe(once);
    expect(tick(once, -10)).toBe(once);
    expect(tick(start, STEP_MS - 1)).toBe(start);
  });

  it('changes only one living player and ignores redundant/unknown steering', () => {
    const start = { ...world(), climbers: [climber(), climber({ id: 'p2' })] };
    const steered = apply(start, 'p1', { type: 'steer', dir: -1 });
    expect(steered.climbers.map((c) => c.dir)).toEqual([-1, 0]);
    expect(steered.climbers[1]).toBe(start.climbers[1]);
    expect(apply(start, 'unknown', { type: 'steer', dir: 1 })).toBe(start);
    expect(apply(start, 'p1', { type: 'steer', dir: 0 })).toBe(start);
  });

  it('generates the same reachable route and spawn for every seat with seeded variety', () => {
    const [one, rng] = makeWorld(seedRng(7), ['p1', 'p2']);
    expect(makeWorld(seedRng(7), ['p1', 'p2'])).toEqual([one, rng]);
    expect(makeWorld(seedRng(8), ['p1', 'p2'])[0].platforms).not.toEqual(one.platforms);
    expect(one.platforms).toHaveLength(261);
    expect(one.climbers.map(({ id: _id, ...c }) => c)[0]).toEqual(
      one.climbers.map(({ id: _id, ...c }) => c)[1],
    );
    for (let i = 1; i < one.platforms.length; i++) {
      const p = one.platforms[i]!;
      const before = one.platforms[i - 1]!;
      expect(p.y - before.y).toBeGreaterThanOrEqual(45);
      expect(p.y - before.y).toBeLessThanOrEqual(64);
      expect(Math.abs(deltaX(before.x, p.x))).toBeLessThanOrEqual(65);
      expect(p.width).toBeGreaterThanOrEqual(44);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(W);
    }
  });

  it('scores the floored nonnegative peak, rather than the current falling height', () => {
    const w = {
      ...world(),
      climbers: [climber({ peak: 129.9, y: 3 }), climber({ id: 'p2', peak: -4 })],
    };
    expect(roundPoints(w)).toEqual({ p1: 129, p2: 0 });
  });
});
