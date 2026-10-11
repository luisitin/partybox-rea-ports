import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { roundPoints } from '../server/scoring';
import type { State } from '../server/types';
import {
  COOLDOWN_MS,
  FALL_V,
  FLAP_V,
  GAP,
  GATE_WIDTH,
  GRAVITY,
  H,
  R,
  ROUND_MS,
  SPEED,
  STEP_MS,
  TICK_MS,
  W,
  X,
  applyFlap,
  birdPosition,
  makeWorld,
  tick,
  visibleGates,
} from '../server/world';
import type { Bird, World } from '../server/world';

const T0 = 1_000_000;
const kit = testKit(game, { t0: T0, settings: { rounds: 3 } });
const bird = (id: string, y = 50, v = 0, extra: Partial<Bird> = {}): Bird => ({
  id,
  flight: { at: 0, y, v },
  died: null,
  passed: 0,
  lastFlap: -COOLDOWN_MS,
  ...extra,
});
const world = (...birds: Bird[]): World => ({ birds, course: [], checked: 0 });
const safe = (): World => world(bird('p1', 50), bird('p2', 50));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

describe('flight', () => {
  it('integrates a flap analytically at the input timestamp', () => {
    const b = bird('p1', 50, FLAP_V);
    const p = birdPosition(b, 200);
    expect(p.y).toBeCloseTo(50 + FLAP_V * 0.2 + (GRAVITY * 0.2 ** 2) / 2, 8);
    expect(p.v).toBeCloseTo(FLAP_V + GRAVITY * 0.2, 8);
    const initial = safe();
    const flap = applyFlap(initial, 'p1', 137);
    expect(initial.birds[0]?.flight.at).toBe(0);
    expect(flap.birds[0]?.flight.at).toBe(137);
    expect(flap.birds[0]?.flight.y).toBeCloseTo(birdPosition(initial.birds[0]!, 137).y, 8);
    expect(flap.birds[0]?.flight.v).toBe(FLAP_V);
    expect(flap.birds[0]?.lastFlap).toBe(137);
  });

  it('caps falling velocity and keeps the displacement continuous at the cap', () => {
    const b = bird('p1', 10);
    const cap = FALL_V / GRAVITY;
    const before = birdPosition(b, cap * 1000);
    expect(before.v).toBeCloseTo(FALL_V, 8);
    const after = birdPosition(b, (cap + 0.5) * 1000);
    expect(after.v).toBe(FALL_V);
    expect(after.y - before.y).toBeCloseTo(FALL_V * 0.5, 8);
  });

  it('ignores unknown and dead birds, backwards inputs and repeat taps inside cooldown', () => {
    const initial = safe();
    expect(applyFlap(initial, 'ghost', 100)).toBe(initial);
    expect(applyFlap(initial, '__proto__', 100)).toBe(initial);
    const dead = world(bird('p1', 50, 0, { died: 0 }));
    expect(applyFlap(dead, 'p1', 200)).toBe(dead);
    const first = applyFlap(initial, 'p1', 200);
    expect(applyFlap(first, 'p1', 199)).toBe(first);
    expect(applyFlap(first, 'p1', 200 + COOLDOWN_MS - 1)).toBe(first);
    expect(applyFlap(first, 'p1', 200 + COOLDOWN_MS)).not.toBe(first);
  });

  it('cannot rescue a bird overlapping a wall between grid samples', () => {
    const initial = world(bird('p1', R - 0.1), bird('p2'));
    const attempted = applyFlap(initial, 'p1', 1);
    expect(attempted.birds[0]?.died).toBe(1);
    expect(attempted.birds[0]?.flight).toEqual(initial.birds[0]?.flight);
  });
});

describe('shared course and collisions', () => {
  it('uses the same seeded course for every lane, with bounded gaps and increasing gates', () => {
    const [a, rng] = makeWorld(seedRng(13), ['p1', 'p2']);
    const [b] = makeWorld(seedRng(13), ['p1', 'p2', 'p3', 'p4']);
    expect(a.course).toEqual(b.course);
    expect(a.course.length).toBeGreaterThan(10);
    expect(rng.step).toBeGreaterThan(0);
    for (const [i, gate] of a.course.entries()) {
      expect(gate.center - GAP / 2).toBeGreaterThanOrEqual(R);
      expect(gate.center + GAP / 2).toBeLessThanOrEqual(H - R);
      if (i) expect(gate.x).toBeGreaterThan(a.course[i - 1]!.x + GATE_WIDTH);
    }
  });

  it('top and floor collisions account for the bird radius', () => {
    const top = tick(world(bird('p1', R - 0.1), bird('p2')), STEP_MS);
    expect(top.birds[0]?.died).toBe(STEP_MS);
    expect(top.birds[1]?.died).toBeNull();
    const bottom = tick(world(bird('p1', H - R + 0.1), bird('p2')), STEP_MS);
    expect(bottom.birds[0]?.died).toBe(STEP_MS);
  });

  it('a centered bird clears a gate; overlapping its gap edge crashes', () => {
    const crossing: World = {
      birds: [bird('p1', 50), bird('p2', 50 + GAP / 2 - R + 0.1)],
      course: [{ x: X + SPEED * (STEP_MS / 1000), center: 50 }],
      checked: 0,
    };
    const judged = tick(crossing, STEP_MS);
    expect(judged.birds[0]?.died).toBeNull();
    expect(judged.birds[1]?.died).toBe(STEP_MS);
  });

  it('the horizontal edge accounts for radius and only checks a nearby gate', () => {
    const atEdge: World = {
      birds: [bird('p1', 15), bird('p2', 50)],
      course: [{ x: X + R + SPEED * (STEP_MS / 1000) - 0.1, center: 50 }],
      checked: 0,
    };
    expect(tick(atEdge, STEP_MS).birds[0]?.died).toBe(STEP_MS);
    const distant = { ...atEdge, course: [{ x: X + R + 2, center: 50 }] };
    expect(tick(distant, STEP_MS).birds[0]?.died).toBeNull();
  });

  it('passes a gate only after its trailing edge clears the bird', () => {
    const t = 500;
    const passed: World = {
      birds: [bird('p1', 40), bird('p2', 40)],
      course: [{ x: X - R - GATE_WIDTH + SPEED * (t / 1000) - 0.1, center: 50 }],
      checked: t - STEP_MS,
    };
    expect(tick(passed, t).birds.map((b) => b.passed)).toEqual([1, 1]);
    const notYet = { ...passed, course: [{ ...passed.course[0]!, x: passed.course[0]!.x + 1 }] };
    expect(tick(notYet, t).birds.map((b) => b.passed)).toEqual([0, 0]);
  });

  it('judges fixed samples, halts immediately at one survivor and is idempotent', () => {
    const initial = freeze(world(bird('p1', H - R), bird('p2', 50)));
    const judged = tick(initial, 10_000);
    expect(judged.checked).toBe(STEP_MS);
    expect(judged.birds[0]?.died).toBe(STEP_MS);
    expect(judged.birds[1]?.died).toBeNull();
    expect(tick(judged, 10_000)).toBe(judged);
    expect(tick(judged, 0)).toBe(judged);
    const unsampled = tick(safe(), STEP_MS - 1);
    expect(unsampled.checked).toBe(0);
  });

  it('only exposes gates inside the stage window', () => {
    const initial: World = {
      ...safe(),
      checked: 1000,
      course: [
        { x: SPEED - GATE_WIDTH - 1, center: 50 },
        { x: SPEED, center: 50 },
        { x: SPEED + W + 1, center: 50 },
      ],
    };
    expect(visibleGates(initial)).toHaveLength(1);
  });

  it('clamps world judging to the round cap even if the event arrives late', () => {
    const initial = world(
      bird('p1', 50, 0, { flight: { at: ROUND_MS, y: 50, v: 0 } }),
      bird('p2', 50, 0, { flight: { at: ROUND_MS, y: 50, v: 0 } }),
    );
    expect(tick(initial, ROUND_MS + STEP_MS).checked).toBe(ROUND_MS);
  });
});

describe('survival scoring and phases', () => {
  it('awards one point for every strictly earlier death, with sample ties and cap ties', () => {
    const ranked = world(
      bird('a', 50, 0, { died: 100 }),
      bird('b', 50, 0, { died: 200 }),
      bird('c', 50, 0, { died: 200 }),
      bird('d'),
      bird('e'),
    );
    expect(roundPoints(ranked)).toEqual({ a: 0, b: 1, c: 1, d: 3, e: 3 });
    expect(roundPoints(world(bird('a'), bird('b')))).toEqual({ a: 0, b: 0 });
  });

  it('ties simultaneous off-grid crashes regardless of which phone sends its flap first', () => {
    const initial = kit.start({
      players: Object.values(kit.start().players).slice(0, 2),
      settings: { rounds: 1 },
    });
    const colliding = {
      ...initial,
      world: {
        ...initial.world,
        birds: initial.world.birds.map((b) => ({ ...b, flight: { at: 0, y: 3.5, v: FLAP_V } })),
      },
    };
    const a = kit.input(colliding, 'p1', { type: 'flap' }, T0 + 19);
    const b = kit.input(colliding, 'p2', { type: 'flap' }, T0 + 19);
    expect(a).toEqual(b);
    expect(a.phase.id).toBe('score');
    expect(a.world.birds.map((x) => x.died)).toEqual([19, 19]);
    expect(a.lastPoints).toEqual({ p1: 0, p2: 0 });
    expect(game.results(kit.timer(a))?.winnerIds).toEqual(['p1', 'p2']);
  });

  it('starts directly in play and schedules one short beat inside the round cap', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + TICK_MS });
    expect(s.round).toBe(1);
    expect(s.settings.rounds).toBe(3);
    expect(s.endsAt).toBe(T0 + ROUND_MS);
    expect(s.world.checked).toBe(0);
    expect(s.scores).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    expect(game.results(s)).toBeNull();
  });

  it('applies a flap at its exact timestamp and refuses old input after judging', () => {
    const start = kit.start();
    const s = kit.input(start, 'p1', { type: 'flap' }, T0 + 137);
    expect(s.world.birds[0]?.flight.at).toBe(137);
    const next = kit.timer(s);
    expect(kit.input(next, 'p1', { type: 'flap' }, T0 + 50)).toBe(next);
  });

  it('scores once, accumulates across exactly three rounds, and returns every player', () => {
    let s = kit.start();
    for (let round = 1; round <= 3; round++) {
      s = {
        ...s,
        world: world(
          bird('p1'),
          bird('p2', 50, 0, { died: 0 }),
          bird('p3', 50, 0, { died: 0 }),
          bird('p4', 50, 0, { died: 0 }),
        ),
      };
      s = kit.timer(s);
      expect(s.phase.id).toBe('score');
      expect(s.scores.p1).toBe(round * 3);
      expect(s.lastPoints).toEqual({ p1: 3, p2: 0, p3: 0, p4: 0 });
      expect(s.phase.deadline! - s.phase.startedAt).toBe(8000);
      const stale = kit.timer(s, s.phase.startedAt);
      expect(stale).toBe(s);
      s = kit.timer(s);
      expect(s.phase.id).toBe(round === 3 ? 'done' : 'play');
      expect(s.round).toBe(Math.min(round + 1, 3));
    }
    expect(game.results(s)?.winnerIds).toEqual(['p1']);
    expect(
      game
        .results(s)
        ?.ranking.map((r) => r.playerId)
        .sort(),
    ).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(kit.timer(s)).toBe(s);
  });

  it('ends at the configured cap and scores living birds equally', () => {
    let s: State = { ...kit.start(), endsAt: T0 + 100, world: safe() };
    s = kit.timer(s, T0 + 5000);
    expect(s.phase.id).toBe('score');
    expect(s.world.checked).toBe(100);
    expect(s.lastPoints).toEqual({ p1: 0, p2: 0 });
  });

  it('skips play into score, score into the next round, and explicitly ends anywhere', () => {
    const start = kit.start();
    const score = kit.vip(start, 'skip', T0 + 100);
    expect(score.phase.id).toBe('score');
    expect(kit.vip(score, 'skip', T0 + 200).round).toBe(2);
    expect(kit.vip(start, 'end').phase.id).toBe('done');
  });

  it('freezes play during pause and shifts both absolute clocks on resume', () => {
    const start = kit.timer(kit.start());
    const pause = kit.vip(start, 'pause', T0 + 200);
    expect(kit.input(pause, 'p1', { type: 'flap' }, T0 + 2000)).toBe(pause);
    expect(kit.timer(pause, T0 + 2000)).toBe(pause);
    const resumed = kit.vip(pause, 'resume', T0 + 5200);
    expect(resumed.began).toBe(start.began + 5000);
    expect(resumed.endsAt).toBe(start.endsAt + 5000);
    expect(resumed.phase.deadline).toBe(start.phase.deadline! + 5000);
    expect(resumed.world).toEqual(pause.world);
  });

  it('rejects stale and early timers, spectators, prototype ids and disconnected inputs', () => {
    const s = kit.start();
    for (const id of ['spectator', '__proto__', 'constructor', '']) {
      expect(kit.input(s, id, { type: 'flap' }, T0 + 100)).toBe(s);
      expect(game.controllerView(s, id).me.role).toBe('spectator');
    }
    expect(kit.timer(s, T0 + TICK_MS - 1)).toBe(s);
    expect(kit.reduce(s, { type: 'timer', now: T0 + 1000, phaseId: 'wrong', startedAt: T0 })).toBe(
      s,
    );
    expect(
      kit.reduce(s, { type: 'timer', now: T0 + 1000, phaseId: 'play', startedAt: T0 - 1 }),
    ).toBe(s);
    const drop = kit.player(s, 'p1', false, undefined, T0 + 20);
    expect(kit.input(drop, 'p1', { type: 'flap' }, T0 + 100)).toBe(drop);
    const back = kit.player(drop, 'p1', true, undefined, T0 + 40);
    expect(back.world).toEqual(drop.world);
    expect(kit.input(back, 'p1', { type: 'flap' }, T0 + 100)).not.toBe(back);
    expect(kit.until(drop, 'done', 200)).toBeDefined();
  });

  it('keeps future course data hidden from every surface, including phone-only spectators', () => {
    const s = kit.start({ presence: { mode: 'together', phoneOnly: true } });
    const changed = {
      ...s,
      world: {
        ...s.world,
        course: s.world.course.map((g) => (g.x > W ? { ...g, center: g.center + 0.321 } : g)),
      },
    };
    expect(game.tvView(changed)).toEqual(game.tvView(s));
    for (const id of [...Object.keys(s.players), 'spectator']) {
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(s, id));
      expect(JSON.stringify(game.controllerView(s, id))).not.toContain('course');
    }
    const rng = createRng(7);
    expect(game.bot.sampleInput(s, 'spectator', rng)).toBeNull();
  });
});

describe('honest bot pilots', () => {
  it('has distinct reaction cadences at a controlled falling position', () => {
    const ready = kit.start();
    const rng = { ...createRng(1), int: () => 0, float: () => 0.99 };
    const reactions = (skill: 'easy' | 'normal' | 'sharp'): number =>
      [0, 100, 200, 300, 400, 500].filter((checked) => {
        const state = { ...ready, world: { ...world(bird('p1', 70), bird('p2')), checked } };
        return game.bot.sampleInput(state, 'p1', rng, skill) !== null;
      }).length;
    expect([reactions('easy'), reactions('normal'), reactions('sharp')]).toEqual([2, 3, 6]);
  });

  it('is reproducible, never uses future gates, and stops while paused or dead', () => {
    const start = kit.start();
    const state = {
      ...start,
      world: {
        ...start.world,
        birds: start.world.birds.map((b) => ({ ...b, flight: { at: 0, y: 70, v: 0 } })),
      },
    };
    const changed = {
      ...state,
      world: {
        ...state.world,
        course: state.world.course.map((g) => (g.x > W ? { ...g, center: 999 } : g)),
      },
    };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      expect(game.bot.sampleInput(state, 'p1', createRng(32), skill)).toEqual(
        game.bot.sampleInput(changed, 'p1', createRng(32), skill),
      );
    }
    expect(game.bot.sampleInput(kit.vip(state, 'pause', T0), 'p1', createRng(1))).toBeNull();
    const dead = {
      ...state,
      world: { ...state.world, birds: state.world.birds.map((b) => ({ ...b, died: 0 })) },
    };
    expect(game.bot.sampleInput(dead, 'p1', createRng(1))).toBeNull();
  });
});
