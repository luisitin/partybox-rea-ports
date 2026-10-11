import { describe, expect, it } from 'vitest';
import {
  axisOf,
  drop,
  DROP_MS,
  GROW,
  GROW_STREAK,
  inputSchema,
  KEEP_BLOCKS,
  makeTower,
  MAX_HEIGHT,
  MIN_WIDTH,
  movingBlock,
  offsetAt,
  PERFECT,
  restart,
  speedAt,
  SWING,
  tolerance,
  WIDTH,
} from '../server/world';
import { RESTART_MS } from '../server/types';
import type { Tower } from '../server/types';
import { T0, timeAtOffset } from './helpers';

describe('sliding geometry', () => {
  it('alternates horizontal axes, uses a capped speed, and bounces symmetrically', () => {
    expect([0, 1, 2, 3].map(axisOf)).toEqual(['x', 'z', 'x', 'z']);
    expect(speedAt(0)).toBe(90);
    expect(speedAt(20)).toBe(130);
    expect(speedAt(40)).toBe(170);
    expect(speedAt(MAX_HEIGHT)).toBe(170);
    const tower = makeTower('a', T0);
    const traverse = (2 * SWING * 1000) / 90;
    expect(offsetAt(tower, T0, 0)).toBe(-SWING);
    expect(offsetAt(tower, T0 + traverse / 2, 0)).toBe(0);
    expect(offsetAt(tower, T0 + traverse, 0)).toBe(SWING);
    expect(offsetAt(tower, T0 + traverse * 2, 0)).toBe(-SWING);
    expect(offsetAt(tower, T0 + traverse / 4, 1)).toBe(SWING / 2);
    expect(offsetAt(tower, T0 - 1000, 0)).toBe(-SWING);
  });

  it.each([-20, 20])('a %s-unit x error keeps the intersection and shifts its center', (offset) => {
    const initial = makeTower('a', T0);
    const before: Tower = { ...initial, footprint: { x: 10, z: -7, w: 80, d: 60 } };
    const now = timeAtOffset(before, offset);
    expect(movingBlock(before, now, 0)).toEqual({ x: 10 + offset, z: -7, w: 80, d: 60 });
    const after = drop(before, now, 0);
    expect(after.footprint).toEqual({ x: 10 + offset / 2, z: -7, w: 60, d: 60 });
    expect(after.cut).toEqual({ axis: 'x', amount: 20, side: Math.sign(offset) });
    expect(after.feedback).toBe('trim');
    expect(after.height).toBe(1);
    expect(before.footprint).toEqual({ x: 10, z: -7, w: 80, d: 60 });
  });

  it('the next floor trims depth rather than width and preserves the inactive coordinate', () => {
    let tower = makeTower('a', T0);
    tower = drop(tower, timeAtOffset(tower, 20), 0);
    tower = drop(tower, timeAtOffset(tower, -12), 0);
    expect(tower.footprint).toEqual({ x: 10, z: -6, w: 60, d: 68 });
    expect(tower.cut).toEqual({ axis: 'z', amount: 12, side: -1 });
    expect(tower.height).toBe(2);
  });

  it('a sliver at the minimum size survives; one smaller and a complete miss crash', () => {
    const tower = makeTower('a', T0);
    const edge = drop(tower, timeAtOffset(tower, WIDTH - MIN_WIDTH), 0);
    expect(edge.footprint.w).toBe(MIN_WIDTH);
    expect(edge.crashedAt).toBeNull();
    for (const offset of [WIDTH - MIN_WIDTH + 0.001, WIDTH, -WIDTH, SWING]) {
      const now = timeAtOffset(tower, offset);
      const missed = drop(tower, now, 0);
      expect(missed.crashedAt).toBe(now);
      expect(missed.feedback).toBe('miss');
      expect(missed.height).toBe(0);
      expect(missed.best).toBe(0);
      expect(missed.footprint).toEqual(tower.footprint);
    }
  });
});

describe('perfects and recovery', () => {
  it.each([-1, 1])(
    'the perfect window is inclusive on the %s side, with no center drift',
    (side) => {
      const tower = makeTower('a', T0);
      expect(tolerance(tower)).toBe(PERFECT);
      for (const error of [PERFECT - 0.001, PERFECT]) {
        const aligned = drop(tower, timeAtOffset(tower, side * error), 0);
        expect(aligned.feedback).toBe('perfect');
        expect(aligned.footprint).toEqual(tower.footprint);
        expect(aligned.cut).toBeNull();
        expect(aligned.perfects).toBe(1);
      }
      const trimmed = drop(tower, timeAtOffset(tower, side * (PERFECT + 0.001)), 0);
      expect(trimmed.feedback).toBe('trim');
      expect(trimmed.perfects).toBe(0);
      expect(trimmed.footprint.w).toBeCloseTo(WIDTH - PERFECT - 0.001, 3);
    },
  );

  it('the window shrinks to six percent of the active narrow dimension', () => {
    const base = makeTower('a', T0);
    const narrow: Tower = { ...base, footprint: { x: 5, z: 8, w: 10, d: 80 } };
    expect(tolerance(narrow)).toBeCloseTo(0.6, 8);
    const atEdge = drop(narrow, timeAtOffset(narrow, 0.6), 0);
    expect(atEdge.footprint).toEqual(narrow.footprint);
    expect(atEdge.feedback).toBe('perfect');
    expect(drop(narrow, timeAtOffset(narrow, 0.601), 0).feedback).toBe('trim');
    expect(tolerance({ ...narrow, height: 1 })).toBe(PERFECT);
  });

  it('regrows only from the third consecutive perfect, on the current axis, and caps at the base', () => {
    const base = makeTower('a', T0);
    let tower: Tower = { ...base, footprint: { x: 3, z: -4, w: 50, d: 50 } };
    for (let streak = 1; streak <= GROW_STREAK; streak++) {
      tower = drop(tower, timeAtOffset(tower, 0), 0);
      expect(tower.streak).toBe(streak);
      expect(tower.perfects).toBe(streak);
      expect(tower.footprint.w).toBe(streak < GROW_STREAK ? 50 : 50 + GROW);
      expect(tower.footprint.d).toBe(50);
      expect(tower.feedback).toBe(streak < GROW_STREAK ? 'perfect' : 'grow');
    }
    tower = drop(tower, timeAtOffset(tower, 0), 0);
    expect(tower.footprint.d).toBe(50 + GROW);
    expect(tower.footprint.x).toBe(3);
    expect(tower.footprint.z).toBe(-4);
    const capped: Tower = { ...tower, height: 4, footprint: { x: 3, z: -4, w: 79, d: 80 } };
    const full = drop(capped, timeAtOffset(capped, 0), 0);
    expect(full.footprint).toEqual({ x: 3, z: -4, w: WIDTH, d: WIDTH });
    expect(full.feedback).toBe('grow');
  });

  it('an imperfect floor resets the streak but retains accumulated perfects', () => {
    let tower = makeTower('a', T0);
    for (let i = 0; i < 4; i++) tower = drop(tower, timeAtOffset(tower, 0), 0);
    tower = drop(tower, timeAtOffset(tower, 15), 0);
    expect(tower.streak).toBe(0);
    expect(tower.perfects).toBe(4);
    const width = tower.footprint.w;
    tower = drop(tower, timeAtOffset(tower, 0), 0);
    expect(tower.streak).toBe(1);
    expect(tower.footprint.w).toBe(width);
    expect(tower.feedback).toBe('perfect');
  });
});

describe('attempts and bounded state', () => {
  it('ignores cooldown taps, crashes, and additional placements at the height limit', () => {
    const tower = makeTower('a', T0);
    expect(drop(tower, T0 + DROP_MS - 0.001, 0)).toBe(tower);
    const crashed: Tower = { ...tower, crashedAt: T0 + 800, feedback: 'miss' };
    expect(drop(crashed, T0 + 3000, 0)).toBe(crashed);
    const capped: Tower = { ...tower, height: MAX_HEIGHT, best: MAX_HEIGHT };
    expect(drop(capped, timeAtOffset(capped, 0), 0)).toBe(capped);
  });

  it('retry unlocks at 650 ms, clears the attempt, and retains the best tower and perfect count', () => {
    let tower = makeTower('a', T0);
    for (let i = 0; i < 3; i++) tower = drop(tower, timeAtOffset(tower, 0), 0);
    const bestBlocks = tower.bestBlocks;
    const crashAt = timeAtOffset(tower, SWING);
    tower = drop(tower, crashAt, 0);
    expect(restart(tower, crashAt + RESTART_MS - 1)).toBe(tower);
    const retried = restart(tower, crashAt + RESTART_MS);
    expect(retried).toMatchObject({
      height: 0,
      best: 3,
      attempt: 1,
      streak: 0,
      perfects: 3,
      crashedAt: null,
    });
    expect(retried.footprint).toEqual({ x: 0, z: 0, w: WIDTH, d: WIDTH });
    expect(retried.bestBlocks).toEqual(bestBlocks);
    expect(retried.blocks).toHaveLength(1);
    expect(retried.movingSince).toBe(crashAt + RESTART_MS);
    expect(restart(retried, crashAt + 5000)).toBe(retried);
    expect(restart({ ...tower, attempt: 200 }, crashAt + RESTART_MS).attempt).toBe(200);
  });

  it('keeps only twelve rendered floors while height and best continue to count', () => {
    let tower = makeTower('a', T0);
    for (let i = 0; i < 25; i++) tower = drop(tower, timeAtOffset(tower, 0), 0);
    expect(tower.height).toBe(25);
    expect(tower.best).toBe(25);
    expect(tower.blocks).toHaveLength(KEEP_BLOCKS);
    expect(tower.bestBlocks).toHaveLength(KEEP_BLOCKS);
  });

  it('validates discriminated inputs and rejects malformed or unbounded numbers', () => {
    expect(inputSchema.safeParse({ type: 'drop', attempt: 0, level: MAX_HEIGHT }).success).toBe(
      true,
    );
    expect(inputSchema.safeParse({ type: 'restart', attempt: 200 }).success).toBe(true);
    for (const invalid of [
      null,
      {},
      { type: 'drop', attempt: 0 },
      { type: 'drop', attempt: -1, level: 0 },
      { type: 'drop', attempt: 1.5, level: 0 },
      { type: 'drop', attempt: 0, level: MAX_HEIGHT + 1 },
      { type: 'drop', attempt: 0, level: Infinity },
      { type: 'restart', attempt: 201 },
      { type: 'restart', attempt: NaN },
    ])
      expect(inputSchema.safeParse(invalid).success, JSON.stringify(invalid)).toBe(false);
  });
});
