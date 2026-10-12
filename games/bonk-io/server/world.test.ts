import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  HEAVY_MASS,
  STEP_MS,
  VANISH_MS,
  W,
  aliveCount,
  apply,
  depart,
  makeWorld,
  platformsAt,
  release,
  tick,
} from './world';
import type { Ball, World } from './types';

const ball = (id: string, slot: number, extra: Partial<Ball> = {}): Ball => ({
  id,
  slot,
  x: 300 + slot * 200,
  y: 372,
  vx: 0,
  vy: 0,
  alive: true,
  move: 0,
  heavy: false,
  grounded: true,
  controlAt: -1,
  coyote: 120,
  jumpQueued: false,
  cause: null,
  diedAt: null,
  ...extra,
});
const world = (...balls: Ball[]): World => ({ balls, stepped: 0, layout: 0 });
const control = (move: -1 | 0 | 1, heavy = false, jump = false) => ({
  type: 'control' as const,
  move,
  heavy,
  jump,
});

describe('deterministic platform physics', () => {
  it('spreads eight safe spawns, keeps stable slots and rotates their positions', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const first = makeWorld(ids, [], 1, 2);
    const next = makeWorld(ids, [], 2, 2);
    for (const b of first.balls) {
      expect(b.y + BALL_RADIUS).toBe(400);
      expect(b.x).toBeGreaterThan(64);
      expect(b.x).toBeLessThan(896);
      expect(next.balls.find((n) => n.id === b.id)?.slot).toBe(b.slot);
      expect(next.balls.find((n) => n.id === b.id)?.x).not.toBe(b.x);
      for (const other of first.balls)
        if (other.id !== b.id) expect(Math.abs(other.x - b.x)).toBeGreaterThan(BALL_RADIUS * 2);
    }
  });

  it('gravity lands on a platform without tunneling at the velocity cap', () => {
    const out = tick(world(ball('a', 0, { y: 210, vy: 900, grounded: false }), ball('b', 1)), 240);
    expect(out.balls[0]?.y).toBe(400 - BALL_RADIUS);
    expect(out.balls[0]?.vy).toBe(0);
    expect(out.balls[0]?.grounded).toBe(true);
  });

  it('keeps idle balls supported and finite, without accumulating input histories', () => {
    const out = tick(world(ball('a', 0), ball('b', 1)), 8000);
    expect(out.balls[0]?.y).toBe(372);
    expect(out.balls.every((b) => [b.x, b.y, b.vx, b.vy].every(Number.isFinite))).toBe(true);
    expect(JSON.stringify(out).length).toBeLessThan(3000);
  });

  it('moves in the requested direction, while heavy is slower to accelerate', () => {
    const start = world(ball('a', 0), ball('b', 1));
    const normal = tick(apply(start, 'a', control(1), 0), 600);
    const heavy = tick(apply(start, 'a', control(1, true), 0), 600);
    expect(normal.balls[0]!.x).toBeGreaterThan(300);
    expect(normal.balls[0]!.vx).toBeGreaterThan(heavy.balls[0]!.vx);
    expect(normal.balls[0]!.x).toBeGreaterThan(heavy.balls[0]!.x);
    const left = tick(apply(start, 'a', control(-1), 0), 200);
    expect(left.balls[0]!.x).toBeLessThan(300);
  });

  it('a grounded tap jumps once; tapping while airborne cannot fly', () => {
    const start = apply(world(ball('a', 0), ball('b', 1)), 'a', control(0, false, true), 0);
    const airborne = tick(start, STEP_MS);
    expect(airborne.balls[0]!.vy).toBeLessThan(0);
    expect(airborne.balls[0]!.grounded).toBe(false);
    expect(airborne.balls[0]!.coyote).toBe(0);
    expect(apply(airborne, 'a', control(0, false, true), STEP_MS).balls[0]).toMatchObject({
      vy: airborne.balls[0]!.vy,
      jumpQueued: false,
    });
    expect(tick(airborne, 1000).balls[0]!.grounded).toBe(true);
  });

  it('heavy trades away jump height as well as movement', () => {
    const start = world(ball('a', 0), ball('b', 1));
    const normal = tick(apply(start, 'a', control(0, false, true), 0), 200);
    const heavy = tick(apply(start, 'a', control(0, true, true), 0), 200);
    expect(normal.balls[0]!.y).toBeLessThan(heavy.balls[0]!.y);
  });

  it('a brief coyote jump works, but expires after the unsupported interval', () => {
    const falling = world(ball('a', 0, { x: 0, grounded: false, coyote: 120 }), ball('b', 1));
    const early = tick(falling, 40);
    expect(apply(early, 'a', control(1, false, true), 40).balls[0]!.jumpQueued).toBe(true);
    const late = tick(falling, 200);
    expect(late.balls[0]!.coyote).toBe(0);
    expect(apply(late, 'a', control(0, false, true), 200).balls[0]!.jumpQueued).toBe(false);
  });

  it('a heavy ball resists and transfers more of a head-on impulse', () => {
    expect(HEAVY_MASS).toBeGreaterThan(1);
    const clash = (heavy: boolean) =>
      tick(world(ball('a', 0, { x: 350, vx: 220, heavy }), ball('b', 1, { x: 410, vx: -220 })), 40);
    const normal = clash(false);
    const heavy = clash(true);
    expect(heavy.balls[0]!.vx).toBeGreaterThan(normal.balls[0]!.vx);
    expect(heavy.balls[1]!.vx).toBeGreaterThan(normal.balls[1]!.vx);
  });

  it('shared contacts give the same judged result when seat array order is reversed', () => {
    const a = world(
      ball('a', 0, { x: 420, vx: 120 }),
      ball('b', 1, { x: 476, vx: 0 }),
      ball('c', 2, { x: 532, vx: -120, heavy: true }),
    );
    const reversed = { ...a, balls: [...a.balls].reverse() };
    const byId = (w: World) => [...w.balls].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(byId(tick(a, 400))).toEqual(byId(tick(reversed, 400)));
  });

  it('judging an idle interval in partitions gives exactly the same result', () => {
    const start = world(ball('a', 0, { move: 1 }), ball('b', 1, { move: -1, heavy: true }));
    expect(tick(tick(tick(start, 320), 760), 1800)).toEqual(tick(start, 1800));
    const out = tick(start, 400);
    expect(tick(out, 400)).toBe(out);
    expect(tick(out, 200)).toBe(out);
  });

  it('shrinks every platform symmetrically from 15 s and removes them at 28 s', () => {
    const initial = platformsAt(1, 0);
    const smaller = platformsAt(1, 21_500);
    initial.forEach((p, index) => {
      const s = smaller[index]!;
      expect(s.width).toBeLessThan(p.width);
      expect(s.x + s.width / 2).toBeCloseTo(p.x + p.width / 2, 4);
    });
    expect(platformsAt(1, VANISH_MS)).toEqual([]);
  });

  it('judges simultaneous falls together as zero survivors and freezes their drawing positions', () => {
    const start = world(
      ball('a', 0, { y: 570, grounded: false }),
      ball('b', 1, { y: 570, grounded: false }),
    );
    const out = tick(start, 200);
    expect(aliveCount(out)).toBe(0);
    expect(out.balls.map((b) => b.diedAt)).toEqual([STEP_MS, STEP_MS]);
    expect(out.balls.map((b) => b.cause)).toEqual(['fall', 'fall']);
    expect(tick(out, 1000)).toBe(out);
  });

  it('release and permanent departure clear held actions without reviving fallen balls', () => {
    const start = world(ball('a', 0, { move: 1, heavy: true, jumpQueued: true }), ball('b', 1));
    const neutral = release(start, 'a');
    expect(neutral.balls[0]).toMatchObject({
      move: 0,
      heavy: false,
      jumpQueued: false,
      alive: true,
    });
    expect(depart(start, 'a', 120).balls[0]).toMatchObject({
      alive: false,
      move: 0,
      heavy: false,
      cause: 'left',
      diedAt: 120,
    });
    expect(makeWorld(['a', 'b'], ['a'], 3, 0).balls[0]!.alive).toBe(false);
  });

  it('a timed release blocks older holds even if already neutral and bounds its active timestamp', () => {
    const start = world(ball('a', 0), ball('b', 1));
    const neutral = release(start, 'a', 235);
    expect(neutral.balls[0]).toMatchObject({ move: 0, heavy: false, controlAt: 235 });
    expect(apply(neutral, 'a', control(1, true), 230)).toBe(neutral);
    expect(apply(neutral, 'a', control(1), 236).balls[0]!.move).toBe(1);
    expect(release(start, 'a', 100_000).balls[0]!.controlAt).toBe(30_000);
    expect(release(start, 'a', -100).balls[0]!.controlAt).toBe(0);
  });

  it('ignores unknown, dead and stale controls and bounds every last coordinate', () => {
    const start = world(ball('a', 0, { controlAt: 100 }), ball('b', 1, { alive: false }));
    expect(apply(start, 'x', control(1), 200)).toBe(start);
    expect(apply(start, 'b', control(1), 200)).toBe(start);
    expect(apply(start, 'a', control(-1), 80)).toBe(start);
    const edge = tick(world(ball('a', 0, { x: W + 100, vx: 550 }), ball('b', 1)), 40);
    expect(edge.balls[0]!.alive).toBe(false);
    expect(edge.balls[0]!.x).toBeLessThanOrEqual(W + BALL_RADIUS * 2);
  });
});
