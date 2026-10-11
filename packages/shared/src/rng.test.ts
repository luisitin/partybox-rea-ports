import { describe, expect, it } from 'vitest';
import { createRng, hashString, nextFloat, nextInt, pick, seedRng, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic and never mutates its input', () => {
    const a = seedRng(42);
    const [v1, a2] = nextFloat(a);
    const [v2] = nextFloat(a);
    expect(v1).toBe(v2);
    expect(a).toEqual({ seed: 42, step: 0 });
    expect(a2).toEqual({ seed: 42, step: 1 });
  });

  it('produces floats in [0, 1) that look uniform', () => {
    const buckets = new Array<number>(10).fill(0);
    let s = seedRng(7);
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const [v, next] = nextFloat(s);
      s = next;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]! += 1;
    }
    for (const count of buckets) {
      // 10 % expected per bucket; allow ±15 % relative deviation
      expect(count).toBeGreaterThan(n * 0.085);
      expect(count).toBeLessThan(n * 0.115);
    }
  });

  it('different seeds differ, neighbouring seeds are decorrelated', () => {
    const [a] = nextFloat(seedRng(1));
    const [b] = nextFloat(seedRng(2));
    const [c] = nextFloat(seedRng(3));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(Math.abs(a - b)).toBeGreaterThan(0.001);
  });

  it('nextInt covers the inclusive range evenly', () => {
    let s = seedRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const [v, next] = nextInt(s, 3, 8);
      s = next;
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7, 8]);
    expect(nextInt(seedRng(1), 5, 2)[0]).toBe(5);
  });

  it('shuffle is a permutation and pick returns a member', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const [out, s2] = shuffle(seedRng(5), items);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(s2.step).toBe(4);
    const [p] = pick(seedRng(5), items);
    expect(items).toContain(p);
    expect(() => pick(seedRng(1), [])).toThrow();
  });

  it('createRng replays the pure helpers exactly', () => {
    const m = createRng(11);
    const a = m.float();
    const b = m.int(0, 100);
    const [pa, s1] = nextFloat(seedRng(11));
    const [pb] = nextInt(s1, 0, 100);
    expect(a).toBe(pa);
    expect(b).toBe(pb);
    expect(m.state()).toEqual({ seed: 11, step: 2 });
    expect(typeof m.chance(0.5)).toBe('boolean');
    expect(m.shuffle([1, 2, 3]).length).toBe(3);
  });

  it('hashString is stable', () => {
    expect(hashString('partybox')).toBe(hashString('partybox'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
