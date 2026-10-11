// Tests for the kaboom kit (T-0646): the grade helpers, and the clock / input / views of `defineKaboomGame` on a toy world.
import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from '@partybox/shared';
import { testKit } from '../contract-tests/kit';
import { gradeOf, scaled, share } from './grade';
import { STEP_MS, defineKaboomGame, inputSchema } from './game';
import type { KaboomRules } from './game';

interface Toy {
  ticks: number;
  taps: number[];
}

const MAX = 10;
const rules: KaboomRules<Toy> = {
  init: (n) => ({ ticks: 0, taps: Array.from({ length: n }, () => 0) }),
  step: (w) => ({ ...w, ticks: w.ticks + 1 }),
  act: (w, seat) => ({ ...w, taps: w.taps.map((v, i) => (i === seat ? v + 1 : v)) }),
  points: (w) => w.taps,
  team: (w) => w.taps.reduce((a, b) => a + b, 0),
  cuts: () => ({ max: MAX, cuts: [8, 5, 2] }),
  over: (w) => w.taps.reduce((a, b) => a + b, 0) >= MAX,
  bot: () => ({ a: 0 }),
};

const manifest = gameManifestSchema.parse({
  id: 'toy-kaboom',
  name: 'Toy',
  icon: '💣',
  tagline: 'A toy world for the kit tests.',
  description: 'Tap as much as you can.',
  howToPlay: ['Tap.', 'Tap again.', 'Tap together.'],
  version: '0.1.0',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 1,
  tags: ['co-op'],
  category: 'classics',
  presence: { needs: 'anywhere' },
  addedOn: '2026-10-07',
  settings: [
    {
      key: 'seconds',
      label: 'Round length',
      description: 'Seconds the round lasts',
      type: 'number',
      default: 20,
      min: 5,
      max: 90,
      step: 5,
    },
  ],
  supportsBots: true,
});

const game = defineKaboomGame({ manifest, rules });
const T0 = 1_000_000;
const kit = testKit(game, {
  t0: T0,
  inputAt: 1000,
  players: [
    { id: 'p1', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'p2', name: 'Ben', avatarId: 'owl', connected: true },
    { id: 'p3', name: 'Cy', avatarId: 'cat', connected: true },
  ],
  settings: { seconds: 20 },
});

describe('grade helpers', () => {
  it('gradeOf picks S / A / B / C at the cuts', () => {
    const cuts = [8, 5, 2] as const;
    expect([10, 8, 7, 5, 4, 2, 1, 0].map((v) => gradeOf(v, cuts))).toEqual([
      'S',
      'S',
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
    ]);
  });

  it('scaled keeps Jamboree cuts at 8 players and shrinks them in proportion below', () => {
    expect(scaled(8, [200, 120, 50])).toEqual([200, 120, 50]);
    expect(scaled(4, [200, 120, 50])).toEqual([100, 60, 25]);
    expect(scaled(12, [200, 120, 50])).toEqual([200, 120, 50]);
  });

  it('scaled stays at least 1 and strictly rising for any small table', () => {
    for (const n of [1, 2, 3, 5]) {
      const [s, a, b] = scaled(n, [6, 4, 2]);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a).toBeGreaterThan(b);
      expect(s).toBeGreaterThan(a);
    }
  });

  it('share turns the best run into rising cuts (about 80 / 50 / 20 percent)', () => {
    expect(share(100)).toEqual([80, 50, 20]);
    const [s, a, b] = share(3);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(a).toBeGreaterThan(b);
    expect(s).toBeGreaterThan(a);
  });
});

describe('defineKaboomGame', () => {
  it('starts in play with the world fresh and the next step armed', () => {
    const s = kit.start();
    expect(s.phase.id).toBe('play');
    expect(s.endsAt - s.began).toBe(20000);
    expect(s.stepped).toBe(0);
    expect(s.phase.deadline).toBe(T0 + STEP_MS);
    expect(s.world).toEqual({ ticks: 0, taps: [0, 0, 0] });
  });

  it('steps the world on the server clock: one step per STEP_MS, however late the timer fires', () => {
    const s = kit.start();
    const late = kit.timer(s, T0 + 1000);
    expect(late.stepped).toBe(1000);
    expect(late.world.ticks).toBe(4);
  });

  it('an act sees the world only up to the last whole step before it', () => {
    const s = kit.input(kit.start(), 'p2', { type: 'act', a: 0 }, T0 + 600);
    expect(s.world.ticks).toBe(2);
    expect(s.stepped).toBe(500);
    expect(s.world.taps).toEqual([0, 1, 0]);
  });

  it('ignores unknown players, and the input schema rejects a stray act', () => {
    const s = kit.start();
    expect(kit.input(s, 'ghost', { type: 'act', a: 0 }, T0 + 600)).toEqual(s);
    expect(inputSchema.safeParse({ type: 'nope' }).success).toBe(false);
    expect(inputSchema.safeParse({ type: 'act', a: 1000 }).success).toBe(false);
    expect(inputSchema.safeParse({ type: 'act', a: 3, b: 1 }).success).toBe(true);
  });

  it('ends at the deadline with the world stepped to the full length', () => {
    const done = kit.finish(kit.start(), 100);
    expect(done.phase.id).toBe('done');
    expect(done.stepped).toBe(20000);
    expect(done.world.ticks).toBe(80);
  });

  it('ends the round early when the rules say it is over, on the act that did it', () => {
    let s = kit.start();
    for (let i = 0; i < MAX; i++) s = kit.input(s, 'p1', { type: 'act', a: 0 }, T0 + 1000 + i);
    expect(s.phase.id).toBe('done');
    expect(game.tvView(s).grade).toBe('S');
    expect(game.results(s)?.ranking[0]?.playerId).toBe('p1');
  });

  it('no act counts once the round is done', () => {
    const done = kit.finish(kit.start(), 100);
    const after = kit.input(done, 'p1', { type: 'act', a: 0 }, T0 + 30000);
    expect(after.world.taps).toEqual([0, 0, 0]);
  });

  it('a pause moves the whole round on by as long as it lasted', () => {
    const s = kit.start();
    const paused = kit.vip(s, 'pause', T0 + 2000);
    const resumed = kit.vip(paused, 'resume', T0 + 7000);
    expect(resumed.endsAt - s.endsAt).toBe(5000);
    expect(resumed.began - s.began).toBe(5000);
  });

  it('a VIP skip while paused moves the round on like a resume', () => {
    const s = kit.start();
    const paused = kit.vip(s, 'pause', T0 + 2000);
    const skipped = kit.vip(paused, 'skip', T0 + 7000);
    expect(skipped.endsAt - s.endsAt).toBe(5000);
    expect(skipped.began - s.began).toBe(5000);
  });

  it('is deterministic: the same events give the same state', () => {
    const run = (): string => {
      let s = kit.start();
      s = kit.input(s, 'p1', { type: 'act', a: 0 }, T0 + 600);
      s = kit.timer(s, T0 + 3000);
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});

describe('kaboom views', () => {
  it('the TV view carries the world, the grade and the points of every seat', () => {
    const s = kit.input(kit.start(), 'p2', { type: 'act', a: 0 }, T0 + 600);
    const v = game.tvView(s);
    expect(v.timerMode).toBe('hidden');
    expect(v.seats).toEqual(['p1', 'p2', 'p3']);
    expect(v.points).toEqual({ p1: 0, p2: 1, p3: 0 });
    expect(v.team).toBe(1);
    expect(v.max).toBe(MAX);
    expect(v.grade).toBe('C');
  });

  it('the phone view has your seat, and -1 and no rank for a stranger', () => {
    const s = kit.start();
    expect(game.controllerView(s, 'p3').seat).toBe(2);
    const stranger = game.controllerView(s, 'nobody');
    expect(stranger.seat).toBe(-1);
    expect(stranger.rank).toBeNull();
  });

  it('rank appears only once the round is over, 1 for the most points', () => {
    let s = kit.start();
    s = kit.input(s, 'p2', { type: 'act', a: 0 }, T0 + 600);
    expect(game.controllerView(s, 'p2').rank).toBeNull();
    const done = kit.finish(s, 100);
    expect(game.controllerView(done, 'p2').rank).toBe(1);
    expect(game.controllerView(done, 'p1').rank).toBe(2);
  });

  it('results list every player with finite scores', () => {
    const done = kit.finish(kit.start(), 100);
    const r = game.results(done);
    expect(r?.ranking).toHaveLength(3);
    for (const row of r?.ranking ?? []) expect(Number.isFinite(row.score)).toBe(true);
  });
});

describe('kaboom bot', () => {
  const rng = { float: () => 0.5 } as never;

  it('plays through the rules while the round runs and waits once it is done', () => {
    const s = kit.start();
    expect(game.bot?.sampleInput(s, 'p1', rng)).toEqual({ type: 'act', a: 0, b: 0 });
    expect(game.bot?.sampleInput(kit.finish(s, 100), 'p1', rng)).toBeNull();
    expect(game.bot?.sampleInput(s, 'ghost', rng)).toBeNull();
  });
});
