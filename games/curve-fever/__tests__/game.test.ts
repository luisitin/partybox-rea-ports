// Unit tests for Curve Fever. The contract suite covers totality/determinism/termination; these pin the rules written in README.md
// (the worm's closed form, crashes, gaps, the round's points, the phase exits) with hand-built events and worlds.
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { roundPoints } from '../server/scoring';
import type { State } from '../server/types';
import { READY_MS, SCORE_MS } from '../server/types';
import {
  COLLIDE,
  H,
  MAX_SEGS,
  OMEGA,
  ROUND_MS,
  SPEED,
  STEP_MS,
  W,
  aliveCount,
  apply,
  finished,
  inGap,
  posAt,
  segPos,
  tick,
} from '../server/world';
import type { Seg, World, Worm } from '../server/world';

const T0 = 1_000_000;

const kit = testKit(game, {
  t0: T0,
  inputAt: 1000,
  players: [
    { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
    { id: 'c', name: 'Cleo', avatarId: 'frog', connected: true },
  ],
  settings: { rounds: 2 },
});

const worm = (id: string, seg: Seg, extra: Partial<Worm> = {}): Worm => ({
  id,
  segs: [seg],
  gaps: [],
  died: null,
  ...extra,
});
const world = (...worms: Worm[]): World => ({ worms, stepped: -1 });

describe('the worm', () => {
  it('moves in a straight line at SPEED, and a held turn is a circle that closes after 2π/ω', () => {
    const straight: Seg = [0, 10, 10, 0, 0];
    expect(segPos(straight, 1000).x).toBeCloseTo(10 + SPEED, 6);
    const circle: Seg = [0, 80, 50, 0.7, 1];
    const lap = (2 * Math.PI * 1000) / OMEGA;
    const end = segPos(circle, lap);
    expect(end.x).toBeCloseTo(80, 3);
    expect(end.y).toBeCloseTo(50, 3);
  });

  it('keeps its place across a steering change', () => {
    const w = apply(world(worm('a', [0, 20, 50, 0, 0])), 'a', { type: 'steer', dir: 1 }, 700);
    const [, x, y] = (w.worms[0]?.segs[1] ?? []) as number[];
    expect(x).toBeCloseTo(20 + SPEED * 0.7, 2);
    expect(y).toBeCloseTo(50, 2);
    expect(posAt(w.worms[0] as Worm, 700).x).toBeCloseTo(x as number, 2);
  });

  it('ignores a change to the way it already goes, a dead worm and a full history', () => {
    const w = world(worm('a', [0, 20, 50, 0, 0]));
    expect(apply(w, 'a', { type: 'steer', dir: 0 }, 500)).toBe(w);
    expect(apply(w, 'x', { type: 'steer', dir: 1 }, 500)).toBe(w);
    const dead = world(worm('a', [0, 20, 50, 0, 0], { died: 100 }));
    expect(apply(dead, 'a', { type: 'steer', dir: 1 }, 500)).toBe(dead);
    const full = world({
      id: 'a',
      segs: Array.from({ length: MAX_SEGS }, (_, i): Seg => [i, 20, 50, 0, i % 2 ? 1 : -1]),
      gaps: [],
      died: null,
    });
    expect(apply(full, 'a', { type: 'steer', dir: 0 }, 9000)).toBe(full);
  });
});

describe('crashes', () => {
  it('a worm that reaches a wall dies on the sample that is outside', () => {
    // Heading right from x = 140: leaves at 160 after 20/SPEED s.
    const w = tick(world(worm('a', [0, 140, 50, 0, 0]), worm('b', [0, 20, 20, Math.PI, 0])), 3000);
    const a = w.worms[0] as Worm;
    expect(a.died).not.toBeNull();
    expect((a.died as number) / 1000).toBeGreaterThan((W - 140 - 1) / SPEED - 0.1);
    expect((a.died as number) / 1000).toBeLessThan((W - 140) / SPEED + 0.1);
    expect(a.died! % STEP_MS).toBe(0);
  });

  it("a worm crossing another worm's trail dies; the trail owner does not", () => {
    // b runs up the middle (x = 80) from the bottom; a runs right along y = 40 and meets b's trail.
    const w = tick(
      world(worm('a', [0, 10, 40, 0, 0]), worm('b', [0, 80, 90, -Math.PI / 2, 0])),
      (70 / SPEED) * 1000 + 200,
    );
    expect(w.worms[0]?.died).not.toBeNull();
    expect(w.worms[1]?.died).toBeNull();
  });

  it('a gap lets a worm through', () => {
    // b runs north through y = 55 first; a crosses that trail later.
    const b = worm('b', [0, 80, 90, -Math.PI / 2, 0]);
    const a = worm('a', [0, 20, 55, 0, 0]);
    const crossing = (60 / SPEED) * 1000 + 600;
    const passed = (35 / SPEED) * 1000;
    expect(tick(world(a, b), crossing).worms[0]?.died).not.toBeNull();
    const hole = { ...b, gaps: [passed - 200, passed + 200] };
    expect(inGap(hole, passed)).toBe(true);
    expect(tick(world(a, hole), crossing).worms[0]?.died).toBeNull();
  });

  it('a worm does not hit the trail it has just laid, but hits its own start after a lap', () => {
    const circle = world(worm('a', [0, 80, 50, 0, 1]), worm('b', [0, 20, 20, 0, 0], { died: 0 }));
    expect(tick(circle, 2000).worms[0]?.died).toBeNull();
    const lap = (2 * Math.PI * 1000) / OMEGA;
    const closed = tick(circle, lap + 600).worms[0]?.died;
    expect(closed).not.toBeNull();
    expect(closed as number).toBeGreaterThan(lap - 400);
  });

  it('judging is idempotent and in order', () => {
    const start = world(worm('a', [0, 40, 50, 0.3, 1]), worm('b', [0, 120, 50, 3, -1]));
    const once = tick(start, 6000);
    expect(tick(once, 6000)).toBe(once);
    const parts = tick(tick(tick(start, 1500), 3200), 6000);
    expect(JSON.stringify(parts)).toBe(JSON.stringify(once));
  });

  it('two worms that meet head-on both die', () => {
    const w = tick(world(worm('a', [0, 60, 50, 0, 0]), worm('b', [0, 100, 50, Math.PI, 0])), 2000);
    expect(w.worms.map((x) => x.died !== null)).toEqual([true, true]);
    expect(finished(w)).toBe(true);
    expect(aliveCount(w)).toBe(0);
  });

  it('a head within COLLIDE of a trail dies, one further away does not', () => {
    expect(COLLIDE).toBeLessThan(2);
    expect(H).toBe(100);
  });
});

describe('points', () => {
  it('each worm scores one point for every worm that died before it', () => {
    const w = world(
      worm('a', [0, 1, 1, 0, 0], { died: 1000 }),
      worm('b', [0, 1, 1, 0, 0], { died: 3000 }),
      worm('c', [0, 1, 1, 0, 0]),
    );
    expect(roundPoints(w)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('worms that die on the same sample tie, and survivors tie at the cap', () => {
    const w = world(
      worm('a', [0, 1, 1, 0, 0], { died: 1000 }),
      worm('b', [0, 1, 1, 0, 0], { died: 1000 }),
      worm('c', [0, 1, 1, 0, 0]),
    );
    expect(roundPoints(w)).toEqual({ a: 0, b: 0, c: 2 });
    const cap = world(
      worm('a', [0, 1, 1, 0, 0]),
      worm('b', [0, 1, 1, 0, 0]),
      worm('c', [0, 1, 1, 0, 0], { died: 500 }),
    );
    expect(roundPoints(cap)).toEqual({ a: 1, b: 1, c: 0 });
  });
});

describe('Curve Fever', () => {
  it('starts in ready: every worm on the board with a tangent heading before they run', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'ready', startedAt: T0, deadline: T0 + READY_MS });
    expect(s.round).toBe(1);
    expect(s.world.worms.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
    for (const x of s.world.worms) {
      const [, px, py, heading] = x.segs[0] as Seg;
      expect(px).toBeGreaterThan(10);
      expect(px).toBeLessThan(W - 10);
      expect(py).toBeGreaterThan(10);
      expect(py).toBeLessThan(H - 10);
      const inward = Math.atan2(H / 2 - py, W / 2 - px);
      expect(Math.cos(heading - inward)).toBeLessThan(0.7);
    }
    expect(game.results(s)).toBeNull();
  });

  it('lets the worms go at the ready deadline: a ROUND_MS round that re-arms every beat', () => {
    const s = kit.timer(kit.start());
    expect(s.phase.id).toBe('play');
    expect(s.endsAt - s.began).toBe(ROUND_MS);
    expect(s.world.stepped).toBe(0);
    expect(s.phase.deadline).toBeLessThanOrEqual(s.endsAt);
    expect(s.phase.deadline).toBeGreaterThan(s.began);
  });

  it('steering is applied at the time the input arrives', () => {
    let s = kit.timer(kit.start());
    s = kit.input(s, 'a', { type: 'steer', dir: 1 }, s.began + 700);
    const segs = s.world.worms.find((x) => x.id === 'a')?.segs ?? [];
    expect(segs).toHaveLength(2);
    expect(segs[1]?.[0]).toBe(700);
    expect(segs[1]?.[4]).toBe(1);
    expect(game.controllerView(s, 'a').turn).toBe(1);
    expect(game.controllerView(s, 'b').turn).toBe(0);
  });

  it('the round ends when one worm is left, scoring it; the standings stay up, then the next round starts', () => {
    let s = kit.timer(kit.start());
    // Run everyone straight: a keeps going while b and c are steered into nothing — just let time pass until the arena kills.
    s = kit.finish(s, 400);
    expect(s.phase.id).toBe('score');
    const pts = Object.values(s.lastPoints).reduce((n, v) => n + v, 0);
    expect(pts).toBeGreaterThan(0);
    expect(s.scores).toEqual(s.lastPoints);
    expect(s.phase.deadline).toBe(s.phase.startedAt + SCORE_MS);
    s = kit.timer(s);
    expect(s.phase.id).toBe('ready');
    expect(s.round).toBe(2);
    expect(s.world.worms.every((x) => x.died === null)).toBe(true);
    expect(s.world.stepped).toBe(-1);
  });

  it('after the last round the match is done, with points added up', () => {
    let s = kit.until(kit.start(), 'done', 4000);
    expect(s.phase.id).toBe('done');
    expect(s.round).toBe(2);
    const res = game.results(s);
    expect(res?.ranking.map((r) => r.playerId).sort()).toEqual(['a', 'b', 'c']);
    s = kit.timer(s);
    expect(s.phase.id).toBe('done');
  });

  it('the VIP can skip the ready countdown, the running round and the standings', () => {
    let s = kit.vip(kit.start(), 'skip');
    expect(s.phase.id).toBe('play');
    s = kit.vip(s, 'skip');
    expect(s.phase.id).toBe('score');
    s = kit.vip(s, 'skip');
    expect(s.phase.id).toBe('ready');
    expect(kit.vip(s, 'end').phase.id).toBe('done');
  });

  it('a pause holds the round clock: the end moves on by as long as it lasted', () => {
    let s = kit.timer(kit.start());
    const ends = s.endsAt;
    s = kit.vip(s, 'pause', s.began + 2000);
    s = kit.vip(s, 'resume', s.began + 7000);
    expect(s.endsAt).toBe(ends + 5000);
    expect(s.began).toBeGreaterThan(T0 + READY_MS);
  });

  it('the round ends at its cap when nobody crashes', () => {
    let s: State = kit.timer(kit.start());
    const safe: Seg[] = [
      [0, 20, 20, 0, 0],
      [0, 20, 50, 0, 0],
      [0, 20, 80, 0, 0],
    ];
    s = {
      ...s,
      endsAt: s.began + 1500,
      world: {
        ...s.world,
        worms: s.world.worms.map((x, i) => ({ ...x, segs: [safe[i] as Seg], gaps: [] })),
      },
    };
    s = kit.finish(s, 100);
    expect(s.phase.id).toBe('score');
    expect(s.checked).toBe(1500);
    expect(s.lastPoints).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('shows the TV every worm and a phone only what its own worm is doing', () => {
    const s = kit.timer(kit.start());
    expect(game.tvView(s).worms).toHaveLength(3);
    const cv = game.controllerView(s, 'b');
    expect(cv.slot).toBe(s.world.worms.findIndex((x) => x.id === 'b'));
    expect(cv.alive).toBe(true);
    expect(cv.aliveCount).toBe(3);
    expect(JSON.stringify(cv)).not.toContain('segs');
  });
});
