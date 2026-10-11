// Part 00 §6's helpers: even teams with bots spread, a seeded tie-break, turns around the table.
import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/shared';
import { majorityPick, rotation, teamsFromSeed } from './turns';

const table = (people: number, bots: number): { id: string; bot?: boolean }[] => [
  ...Array.from({ length: people }, (_, i) => ({ id: `p${i}` })),
  ...Array.from({ length: bots }, (_, i) => ({ id: `b${i}`, bot: true })),
];

describe('teamsFromSeed', () => {
  it('makes even teams and spreads the bots, for every table size and seed', () => {
    for (let n = 0; n <= 16; n += 1)
      for (let bots = 0; bots <= n; bots += 1)
        for (let seed = 1; seed <= 12; seed += 1) {
          const players = table(n - bots, bots);
          const [{ sun, moon }] = teamsFromSeed(players, seedRng(seed));
          expect(Math.abs(sun.length - moon.length)).toBeLessThanOrEqual(1);
          const botsIn = (team: string[]): number => team.filter((id) => id.startsWith('b')).length;
          expect(Math.abs(botsIn(sun) - botsIn(moon))).toBeLessThanOrEqual(1);
          expect([...sun, ...moon].sort()).toEqual(players.map((p) => p.id).sort());
        }
  });

  it('keeps seat order inside each team and is the same for the same seed', () => {
    const players = table(5, 2);
    const [a, next] = teamsFromSeed(players, seedRng(7));
    const [b] = teamsFromSeed(players, seedRng(7));
    expect(a).toEqual(b);
    const seat = (id: string): number => players.findIndex((p) => p.id === id);
    for (const team of [a.sun, a.moon])
      expect([...team].sort((x, y) => seat(x) - seat(y))).toEqual(team);
    expect(next).not.toEqual(seedRng(7));
  });

  it('shuffles: the next draw (Spy Grid’s Shuffle) gives other teams', () => {
    const players = table(8, 0);
    let rng = seedRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const [teams, next] = teamsFromSeed(players, rng);
      seen.add(teams.sun.join());
      rng = next;
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('never throws: an empty room, one player, a repeated id', () => {
    expect(teamsFromSeed([], seedRng(1))[0]).toEqual({ sun: [], moon: [] });
    const [one] = teamsFromSeed([{ id: 'p0' }], seedRng(1));
    expect([...one.sun, ...one.moon]).toEqual(['p0']);
    const [dup] = teamsFromSeed([{ id: 'p0' }, { id: 'p0' }, { id: 'p1' }], seedRng(1));
    expect([...dup.sun, ...dup.moon].sort()).toEqual(['p0', 'p1']);
  });
});

describe('majorityPick', () => {
  it('returns the most-voted choice without drawing from the rng', () => {
    const rng = seedRng(5);
    expect(majorityPick({ a: 'x', b: 'y', c: 'x', d: null }, rng)).toEqual(['x', rng]);
  });

  it('breaks a tie with the rng, among the tied only, whatever order the votes came in', () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const [choice, next] = majorityPick(
        { a: 'x', b: 'y', c: 'z', d: 'y', e: 'x' },
        seedRng(seed),
      );
      const [again] = majorityPick({ e: 'x', d: 'y', c: 'z', b: 'y', a: 'x' }, seedRng(seed));
      expect(again).toBe(choice);
      expect(next).not.toEqual(seedRng(seed));
      picked.add(choice ?? '');
    }
    expect([...picked].sort()).toEqual(['x', 'y']);
  });

  it('returns null with no votes and leaves the rng alone', () => {
    const rng = seedRng(9);
    expect(majorityPick({}, rng)).toEqual([null, rng]);
    expect(majorityPick({ a: null, b: undefined }, rng)).toEqual([null, rng]);
  });
});

describe('rotation', () => {
  const seats = ['a', 'b', 'c'];
  it('passes the turn around the table and wraps', () => {
    expect([0, 1, 2, 3, 4].map((r) => rotation(seats, r))).toEqual(['a', 'b', 'c', 'a', 'b']);
  });
  it('skips a player who left (Echo) and gives null when nobody is left', () => {
    const here = (id: string): boolean => id !== 'b';
    expect(rotation(seats, 1, here)).toBe('c');
    expect(rotation(seats, 2, here)).toBe('c');
    expect(rotation(seats, 1, () => false)).toBeNull();
  });
  it('never throws: an empty table, a negative, fractional or non-finite round', () => {
    expect(rotation([], 3)).toBeNull();
    expect(rotation(seats, -1)).toBe('c');
    expect(rotation(seats, 1.7)).toBe('b');
    expect(rotation(seats, Number.NaN)).toBe('a');
  });
});
