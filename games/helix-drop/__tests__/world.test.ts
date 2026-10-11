import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { angleDifference, freshRunner, makeTower } from '../server/content';
import { settle, stepRunner, surfaceAt } from '../server/world';
import type { Ring, Runner } from '../server/types';
import { kit, freeze } from './helpers';

const safe: Ring = { gap: 180, width: 90, danger: 90, dangerWidth: 40 };
const gap: Ring = { ...safe, gap: 0 };
const danger: Ring = { ...safe, danger: 0 };
const landing = (extra: Partial<Runner> = {}): Runner => ({
  ...freshRunner('a', 3),
  y: -0.01,
  vy: 1,
  ...extra,
});

describe('tower geometry and physics', () => {
  it('wraps both directions and takes the shortest arc', () => {
    expect(angleDifference(5, 355)).toBe(10);
    expect(angleDifference(355, 5)).toBe(-10);
    expect(surfaceAt({ ...gap, gap: 355 }, 5)).toBe('gap');
  });
  it('gaps need clearance at the edge and danger includes its boundary', () => {
    expect(surfaceAt(gap, 0)).toBe('gap');
    expect(surfaceAt(gap, 41)).toBe('safe');
    expect(surfaceAt(danger, 24)).toBe('danger');
    expect(surfaceAt(danger, 25)).toBe('safe');
  });
  it('a gap advances one completed floor and retains the best depth', () => {
    const r = stepRunner(freeze(landing({ best: 7 })), [gap, safe], 20);
    expect(r).toMatchObject({ floor: 1, chain: 1, best: 7, lives: 3, cleared: false });
    expect(stepRunner(landing(), [gap, safe], 20).best).toBe(1);
  });
  it('solid safe surfaces bounce and break the uninterrupted chain', () => {
    const r = stepRunner(landing({ chain: 2 }), [safe], 20);
    expect(r).toMatchObject({ floor: 0, y: 0, vy: -4.2, chain: 0, lives: 3 });
  });
  it('danger consumes exactly one life and starts a 1.2s recovery', () => {
    const r = stepRunner(landing({ best: 9, chain: 2 }), [danger], 20);
    expect(r).toMatchObject({
      lives: 2,
      best: 9,
      floor: 0,
      chain: 0,
      dir: 0,
      respawnAt: 1220,
      crashed: 1,
    });
    expect(stepRunner(r, [danger], 1200)).toBe(r);
    const reborn = stepRunner(r, [danger], 1220);
    expect(reborn).toMatchObject({
      floor: 0,
      y: -0.8,
      vy: 0,
      best: 9,
      lives: 2,
      respawnAt: null,
      crashed: 1,
    });
  });
  it('three gaps arm exactly one smash, including on danger', () => {
    const r = stepRunner(landing({ chain: 3 }), [danger, danger], 20);
    expect(r).toMatchObject({ floor: 1, best: 1, chain: 0, smashes: 1, lives: 3 });
    expect(stepRunner({ ...r, y: 0.99, vy: 1 }, [danger, danger], 40).lives).toBe(2);
  });
  it('dead and cleared runners never move; finishing the tower marks success', () => {
    const dead = landing({ lives: 0 });
    expect(stepRunner(dead, [gap], 20)).toBe(dead);
    const cleared = stepRunner(landing(), [gap], 20);
    expect(cleared).toMatchObject({ floor: 1, best: 1, cleared: true, dir: 0 });
    expect(stepRunner(cleared, [gap], 40)).toBe(cleared);
  });
  it('rotation moves 3 degrees per sample and stops when its lease expires', () => {
    const r = landing({ dir: 1, heldUntil: 20, y: -3 });
    const moved = stepRunner(r, [safe], 20);
    expect(moved.angle).toBe(3);
    expect(stepRunner(moved, [safe], 40)).toMatchObject({ angle: 3, dir: 0 });
    expect(stepRunner({ ...r, dir: -1 }, [safe], 20).angle).toBe(357);
  });
  it('gravity never exceeds terminal speed and bounce moves upward first', () => {
    expect(stepRunner(landing({ y: -3, vy: 20 }), [safe], 20).vy).toBe(8);
    const bounced = stepRunner(landing(), [safe], 20);
    expect(stepRunner(bounced, [safe], 40).y).toBeLessThan(0);
    expect(stepRunner(landing({ y: -3, vy: 0 }), [safe], 20).vy).toBeCloseTo(0.28);
  });
  it('settling is immutable, idempotent and independent of event batching', () => {
    const s = freeze(kit.start());
    const once = settle(s, 4000);
    expect(settle(once, 4000)).toBe(once);
    expect(settle(settle(s, 1763), 4000)).toEqual(once);
    expect(s.checked).toBe(0);
    expect(settle(s, 9_000_000).checked).toBe(60_000);
  });
  it('generation is seeded, bounded and starts with three safe rings', () => {
    const [tower, rng] = makeTower(seedRng(77));
    expect(makeTower(seedRng(77))).toEqual([tower, rng]);
    expect(tower).toHaveLength(120);
    expect(tower.slice(0, 3).every((r) => r.dangerWidth === 0)).toBe(true);
    expect(tower.slice(3).every((r) => r.dangerWidth > 0)).toBe(true);
    expect(tower.every((r) => r.width >= 76 && r.width <= 112)).toBe(true);
    expect(makeTower(seedRng(78))[0]).not.toEqual(tower);
  });
});
