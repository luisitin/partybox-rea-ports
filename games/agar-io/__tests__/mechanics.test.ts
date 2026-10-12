import { createRng, seedRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { botInput } from '../server/bot';
import { resolveCells } from '../server/collisions';
import { clampCell, distance, radius, speed } from '../server/geometry';
import { game } from '../server/index';
import { roundPoints } from '../server/scoring';
import { makeWorld, spawnCell } from '../server/spawn';
import {
  EAT_RATIO,
  H,
  MAX_CELLS,
  MERGE_MS,
  PELLET_COUNT,
  PELLET_MASS,
  RESPAWN_MS,
  ROUND_MS,
  SHIELD_MS,
  SPLIT_COOLDOWN_MS,
  SPLIT_MIN,
  START_MASS,
  STEP_MS,
  W,
} from '../server/types';
import { apply, release, retire, tick, totalMass } from '../server/world';
import type { State } from '../server/types';
import { cell, deepFreeze, stateWithWorld, world } from './helpers';

describe('growth and steering', () => {
  it('mass increases area and reduces speed, with a minimum speed and maximum radius', () => {
    expect(radius(START_MASS)).toBeCloseTo(Math.sqrt(START_MASS) * 0.55);
    expect(radius(START_MASS * 4)).toBeCloseTo(radius(START_MASS) * 2);
    expect(speed(START_MASS)).toBe(20);
    expect(speed(START_MASS * 4)).toBeLessThan(speed(START_MASS));
    expect(speed(1e12)).toBe(6);
    expect(radius(1e12)).toBe(24);
  });

  it('normalizes diagonal steering and leaves its source untouched', () => {
    const before = deepFreeze(world());
    const next = apply(before, 'p1', { type: 'steer', x: 1, y: 1 }, 100);
    expect(next.controls.p1?.x).toBeCloseTo(Math.SQRT1_2, 4);
    expect(next.controls.p1?.y).toBeCloseTo(Math.SQRT1_2, 4);
    expect(Math.hypot(next.controls.p1!.x, next.controls.p1!.y)).toBeCloseTo(1, 4);
    expect(before.controls.p1?.x).toBe(0);
    const repeated = apply(next, 'p1', { type: 'steer', x: 1, y: 1 }, 500);
    expect(repeated.controls.p1).toEqual({ ...next.controls.p1!, at: 500 });
    expect(apply(repeated, 'p1', { type: 'steer', x: -1, y: 0 }, 499)).toBe(repeated);
    expect(apply(repeated, 'p1', { type: 'steer', x: 1, y: 1 }, 500)).toBe(repeated);
  });

  it('has slower large-cell travel, radius-aware walls, and no movement from a neutral pad', () => {
    const start = world([cell('p1'), cell('p2', { id: 2, x: 60, y: 80, mass: 96 })]);
    const moved = apply(
      apply(start, 'p1', { type: 'steer', x: 1, y: 0 }, 100),
      'p2',
      { type: 'steer', x: 1, y: 0 },
      100,
    );
    const [end] = tick(moved, seedRng(1), 1000);
    expect(end.cells[0]!.x - 60).toBeCloseTo(20, 3);
    expect(end.cells[1]!.x - 60).toBeLessThan(20);
    expect(tick(start, seedRng(1), 1000)[0].cells[0]!.x).toBe(60);
    const wall = clampCell(cell('p1', { x: -10, y: 1000, mass: 96 }));
    expect(wall.x).toBeCloseTo(radius(96), 3);
    expect(wall.y).toBeCloseTo(H - radius(96), 3);
    const [atWall] = tick(
      apply(world([cell('p1', { x: 155 })]), 'p1', { type: 'steer', x: 1, y: 0 }, 100),
      seedRng(1),
      5000,
    );
    expect(atWall.cells[0]!.x).toBeCloseTo(W - radius(START_MASS), 3);
  });

  it('ignores unknown owners, prototype names and events before the physics or input clock', () => {
    const start = world();
    for (const id of ['unknown', '__proto__', 'constructor'])
      expect(apply(start, id, { type: 'steer', x: 1, y: 0 }, 100)).toBe(start);
    const later = apply(start, 'p1', { type: 'steer', x: 1, y: 0 }, 500);
    expect(apply(later, 'p1', { type: 'steer', x: -1, y: 0 }, 499)).toBe(later);
    const stepped = { ...later, time: 1000 };
    expect(apply(stepped, 'p1', { type: 'split' }, 999)).toBe(stepped);
  });

  it('an already-neutral release still records its event-time barrier without changing split cooldown', () => {
    const start = deepFreeze(
      world([cell()], {
        time: 200,
        controls: { p1: { x: 0, y: 0, at: 100, splitAt: 50 } },
      }),
    );
    const released = release(start, 'p1', 235);
    expect(released.controls.p1).toEqual({ x: 0, y: 0, at: 235, splitAt: 50 });
    expect(apply(released, 'p1', { type: 'steer', x: 1, y: 0 }, 230)).toBe(released);
    expect(apply(released, 'p1', { type: 'steer', x: 1, y: 0 }, 236).controls.p1?.x).toBe(1);
    expect(release(start, 'p1', 100000).controls.p1?.at).toBe(ROUND_MS);
    expect(release(start, 'p1', -100).controls.p1?.at).toBe(200);
    expect(start.controls.p1?.at).toBe(100);
  });

  it('retirement removes all owned pieces and pending respawns while keeping other seats intact', () => {
    const start = deepFreeze(
      world([cell('p1'), cell('p1', { id: 2, x: 70 }), cell('p2', { id: 3, x: 100 })], {
        respawns: { p1: 3000, p2: 4000 },
      }),
    );
    const gone = retire(start, 'p1', 235);
    expect(gone.cells).toEqual([start.cells[2]]);
    expect(gone.respawns).toEqual({ p2: 4000 });
    expect(gone.controls.p1).toMatchObject({ x: 0, y: 0, at: 235 });
    expect(retire(gone, 'p1', 235)).toBe(gone);
    expect(start.cells).toHaveLength(3);
  });
});

describe('splitting and rejoining', () => {
  it('splits exactly 48 mass in half, conserves mass, and launches in the pad direction', () => {
    const start = deepFreeze(
      world([cell('p1', { mass: SPLIT_MIN })], {
        controls: { p1: { x: 0, y: -1, at: 0, splitAt: -1000 } },
      }),
    );
    const next = apply(start, 'p1', { type: 'split' }, 1000);
    expect(next.cells).toHaveLength(2);
    expect(next.cells.map((c) => c.mass)).toEqual([24, 24]);
    expect(totalMass(next, 'p1')).toBe(SPLIT_MIN);
    expect(next.cells[1]!.x).toBe(next.cells[0]!.x);
    expect(next.cells[1]!.y).toBeLessThan(next.cells[0]!.y);
    expect(next.cells[1]!.vy).toBe(-55);
    expect(next.cells[1]!.vx).toBe(0);
    expect(next.cells.every((c) => c.mergeAt === 1000 + MERGE_MS)).toBe(true);
    expect(next.controls.p1?.splitAt).toBe(1000);
    expect(next.serial).toBe(start.serial + 1);
    expect(start.cells).toHaveLength(1);
  });

  it('requires enough mass, an aim, no shield, a free slot and the one-second cooldown', () => {
    const aimed = { p1: { x: 1, y: 0, at: 0, splitAt: -1000 } };
    for (const w of [
      world([cell('p1', { mass: SPLIT_MIN - 0.01 })], { controls: aimed }),
      world([cell('p1', { mass: 96 })]),
      world([cell('p1', { mass: 96, shieldUntil: 2000 })], { controls: aimed }),
      world(
        Array.from({ length: MAX_CELLS }, (_, id) => cell('p1', { id, mass: 96 })),
        { controls: aimed },
      ),
    ]) {
      expect(apply(w, 'p1', { type: 'split' }, 1000)).toBe(w);
    }
    const start = world([cell('p1', { mass: 192 })], { controls: aimed });
    const first = apply(start, 'p1', { type: 'split' }, 1000);
    expect(apply(first, 'p1', { type: 'split' }, 1000 + SPLIT_COOLDOWN_MS - 1)).toBe(first);
    const second = apply(first, 'p1', { type: 'split' }, 1000 + SPLIT_COOLDOWN_MS);
    expect(second.cells).toHaveLength(MAX_CELLS);
    expect(totalMass(second, 'p1')).toBe(192);
    expect(apply(second, 'p1', { type: 'split' }, 4000)).toBe(second);
  });

  it('does not eat siblings during their eight-second merge lock, then merges mass and center', () => {
    const siblings = [
      cell('p1', { mass: 96, mergeAt: MERGE_MS }),
      cell('p1', { id: 2, x: 62, mass: 24, mergeAt: MERGE_MS }),
    ];
    expect(resolveCells(siblings, MERGE_MS - 1)).toHaveLength(2);
    const merged = resolveCells(siblings, MERGE_MS);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.mass).toBe(120);
    expect(merged[0]!.x).toBeCloseTo((60 * 96 + 62 * 24) / 120, 4);
    expect(merged[0]!.vx).toBe(0);
    expect(merged[0]!.vy).toBe(0);
  });

  it('brings separated siblings back together after the lock without another input', () => {
    const split = apply(
      world([cell('p1', { mass: 96 })], {
        controls: { p1: { x: 1, y: 0, at: 0, splitAt: -1000 } },
      }),
      'p1',
      { type: 'split' },
      1000,
    );
    const stopped = apply(split, 'p1', { type: 'steer', x: 0, y: 0 }, 1100);
    expect(tick(stopped, seedRng(1), 8999)[0].cells).toHaveLength(2);
    const [joined] = tick(stopped, seedRng(1), 15000);
    expect(joined.cells).toHaveLength(1);
    expect(totalMass(joined, 'p1')).toBe(96);
  });
});

describe('eating', () => {
  it('requires at least a 1.25 mass ratio, including the equality boundary', () => {
    const meal = (mass: number) => [cell('p1', { mass }), cell('p2', { id: 2, mass: 24 })];
    expect(resolveCells(meal(24 * EAT_RATIO - 0.001), 1000)).toHaveLength(2);
    const eaten = resolveCells(meal(24 * EAT_RATIO), 1000);
    expect(eaten).toHaveLength(1);
    expect(eaten[0]!.owner).toBe('p1');
    expect(eaten[0]!.mass).toBe(54);
    expect(resolveCells(meal(24), 1000)).toHaveLength(2);
  });

  it('requires deep overlap, rather than grazing the larger edge', () => {
    const cutoff = radius(96) - radius(24) * 0.35;
    const near = [cell('p1', { mass: 96 }), cell('p2', { id: 2, x: 60 + cutoff + 0.01 })];
    expect(resolveCells(near, 1000)).toHaveLength(2);
    expect(
      resolveCells([{ ...near[0]! }, { ...near[1]!, x: 60 + cutoff - 0.01 }], 1000),
    ).toHaveLength(1);
  });

  it('protects both predator and prey until their shields expire', () => {
    for (const owner of ['p1', 'p2']) {
      const pair = [
        cell('p1', { mass: 96, shieldUntil: owner === 'p1' ? 2000 : 0 }),
        cell('p2', { id: 2, shieldUntil: owner === 'p2' ? 2000 : 0 }),
      ];
      expect(resolveCells(pair, 1999)).toHaveLength(2);
      expect(resolveCells(pair, 2000)).toHaveLength(1);
    }
  });

  it('allows a later cell to eat an earlier one deterministically, conserving all mass', () => {
    const source = deepFreeze([
      cell('p1'),
      cell('p2', { id: 2, mass: 96 }),
      cell('p3', { id: 3, x: 100 }),
    ]);
    const end = resolveCells(source, 1000);
    expect(end.map((c) => c.owner)).toEqual(['p2', 'p3']);
    expect(end[0]!.mass).toBe(120);
    expect(end.reduce((n, c) => n + c.mass, 0)).toBe(144);
    expect(resolveCells([...source].reverse(), 1000)).toEqual(end);
    expect(source[0]!.mass).toBe(24);
  });

  it('a pellet adds exactly three mass and is replaced with the same id from state.rng', () => {
    const start = deepFreeze(
      world([cell('p1', { shieldUntil: 1000 })], {
        pellets: [
          { id: 7, x: 60, y: 50 },
          { id: 9, x: 150, y: 90 },
        ],
      }),
    );
    const rng = seedRng(123);
    const [end, nextRng] = tick(start, rng, STEP_MS);
    expect(totalMass(end, 'p1')).toBe(START_MASS + PELLET_MASS);
    expect(end.pellets).toHaveLength(2);
    expect(end.pellets.map((p) => p.id)).toEqual([7, 9]);
    expect(end.pellets[0]).not.toEqual(start.pellets[0]);
    expect(nextRng.step).toBe(rng.step + 2);
    expect(tick(start, rng, STEP_MS)).toEqual([end, nextRng]);
    expect(start.cells[0]!.mass).toBe(START_MASS);
  });

  it('clamps newly grown cells at the walls on the same physics step', () => {
    const c = clampCell(cell('p1', { x: 0, y: 0 }));
    const [end] = tick(world([c], { pellets: [{ id: 1, x: c.x, y: c.y }] }), seedRng(1), STEP_MS);
    expect(end.cells[0]!.x).toBeGreaterThanOrEqual(radius(end.cells[0]!.mass) - 0.0001);
    expect(end.cells[0]!.y).toBeGreaterThanOrEqual(radius(end.cells[0]!.mass) - 0.0001);
  });

  it('the nearest overlapping cell wins a snack independently of storage order without a tie draw', () => {
    const start = deepFreeze(
      world([cell('p1', { x: 58 }), cell('p2', { id: 2, x: 60.5 }), cell('p3', { id: 3, x: 61 })], {
        pellets: [{ id: 0, x: 60, y: 50 }],
      }),
    );
    const rng = seedRng(17);
    const [end, next] = tick(start, rng, STEP_MS);
    expect(end.cells.map((c) => c.mass)).toEqual([24, 27, 24]);
    expect(next.step).toBe(rng.step + 2);
    expect(tick({ ...start, cells: [...start.cells].reverse() }, rng, STEP_MS)).toEqual([
      end,
      next,
    ]);
    expect(end.cells.reduce((sum, c) => sum + c.mass, 0)).toBe(72 + PELLET_MASS);
  });

  it('equal and rounding-sized snack ties replay by seed and can reward either rival', () => {
    for (const right of [61, 61.0004]) {
      const start = deepFreeze(
        world([cell('p1', { x: 59 }), cell('p2', { id: 2, x: right })], {
          pellets: [{ id: 0, x: 60, y: 50 }],
        }),
      );
      const winners = new Set<string>();
      for (let seed = 1; seed <= 64; seed++) {
        const rng = seedRng(seed);
        const [end, next] = tick(start, rng, STEP_MS);
        const winner = end.cells.find((c) => c.mass === START_MASS + PELLET_MASS)!;
        winners.add(winner.owner);
        expect(end.cells.reduce((sum, c) => sum + c.mass, 0)).toBe(48 + PELLET_MASS);
        expect(next.step).toBe(rng.step + 3);
        expect(tick(start, rng, STEP_MS)).toEqual([end, next]);
        expect(tick({ ...start, cells: [...start.cells].reverse() }, rng, STEP_MS)).toEqual([
          end,
          next,
        ]);
      }
      expect([...winners].sort()).toEqual(['p1', 'p2']);
    }
  });

  it('snack ties use the actual minimum distance and exclude a farther tolerance chain', () => {
    const start = world(
      [cell('p1', { x: 61.0018 }), cell('p2', { id: 2, x: 61.0009 }), cell('p3', { id: 3, x: 59 })],
      { pellets: [{ id: 0, x: 60, y: 50 }] },
    );
    const winners = new Set<string>();
    for (let seed = 1; seed <= 64; seed++) {
      const [end] = tick(start, seedRng(seed), STEP_MS);
      const winner = end.cells.find((c) => c.mass === START_MASS + PELLET_MASS)!;
      expect(winner.owner).not.toBe('p1');
      winners.add(winner.owner);
    }
    expect([...winners].sort()).toEqual(['p2', 'p3']);
  });
});

describe('spawn and clocks', () => {
  it('creates 96 bounded seeded pellets and one independent safe blob per seat', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const [start, rng] = makeWorld(seedRng(7), ids);
    expect(start.cells.map((c) => c.owner)).toEqual(ids);
    expect(new Set(start.cells.map((c) => c.id)).size).toBe(8);
    expect(start.cells.every((c) => c.mass === START_MASS && c.shieldUntil === 1000)).toBe(true);
    expect(start.pellets).toHaveLength(PELLET_COUNT);
    expect(start.pellets.every((p) => p.x >= 4 && p.x <= W - 4 && p.y >= 4 && p.y <= H - 4)).toBe(
      true,
    );
    expect(makeWorld(seedRng(7), ids)).toEqual([start, rng]);
    expect(makeWorld(seedRng(8), ids)[0]).not.toEqual(start);
    const [spawn] = spawnCell({ ...start, time: 5000 }, 'new', rng);
    expect(spawn.shieldUntil).toBe(5000 + SHIELD_MS);
  });

  it('respawns a swallowed player exactly three seconds later with two seconds of protection', () => {
    const start = world([cell('p1'), cell('p2', { id: 2, mass: 96 })]);
    const [eaten, r1] = tick(start, seedRng(9), STEP_MS);
    expect(eaten.cells.some((c) => c.owner === 'p1')).toBe(false);
    expect(eaten.respawns.p1).toBe(STEP_MS + RESPAWN_MS);
    expect(eaten.controls.p1?.x).toBe(0);
    const [waiting, r2] = tick(eaten, r1, STEP_MS + RESPAWN_MS - 1);
    expect(waiting.cells.some((c) => c.owner === 'p1')).toBe(false);
    const [returned] = tick(waiting, r2, STEP_MS + RESPAWN_MS);
    const c = returned.cells.find((c) => c.owner === 'p1')!;
    expect(c.mass).toBe(START_MASS);
    expect(c.shieldUntil).toBe(STEP_MS + RESPAWN_MS + SHIELD_MS);
    expect(returned.respawns).not.toHaveProperty('p1');
    expect(c.id).toBe(start.serial);
  });

  it('never respawns a permanently departed seat', () => {
    const start = world([], { controls: { p1: { x: 1, y: 0, at: 0, splitAt: -1000 } } });
    const [end] = tick(start, seedRng(1), 10000, ['p1']);
    expect(end.cells).toHaveLength(0);
    expect(end.respawns).toEqual({});
  });

  it('is identical when ticked in chunks, idempotent, and rounds down to the 100 ms grid', () => {
    const [start, rng] = makeWorld(seedRng(21), ['p1', 'p2']);
    const steered = apply(start, 'p1', { type: 'steer', x: 1, y: -0.5 }, 100);
    const [end, endRng] = tick(steered, rng, 5000);
    const [middle, middleRng] = tick(steered, rng, 2100);
    expect(tick(middle, middleRng, 5000)).toEqual([end, endRng]);
    expect(tick(end, endRng, 5000)[0]).toBe(end);
    expect(tick(end, endRng, 4999)[0]).toBe(end);
    expect(tick(start, rng, 199)[0].time).toBe(100);
  });
});

describe('points and bot decisions', () => {
  it('scores floored total surviving mass, including all split parts and zero for swallowed seats', () => {
    const w = world([
      cell('p1', { mass: 30.6 }),
      cell('p1', { id: 2, mass: 23.6 }),
      cell('p2', { id: 3, mass: 9.9 }),
    ]);
    expect(roundPoints(w, ['p1', 'p2', 'p3'])).toEqual({ p1: 54, p2: 9, p3: 0 });
    expect(roundPoints(world([cell('p1', { mass: 24 })]), ['p1'])).toEqual({ p1: 24 });
  });

  it('normal and sharp bots flee a nearby predator while easy bots keep grazing', () => {
    const s = stateWithWorld(
      world([cell('p1'), cell('p2', { id: 2, x: 65, mass: 100 })], {
        pellets: [{ id: 1, x: 70, y: 50 }],
      }),
    );
    for (const skill of ['normal', 'sharp'] as const)
      expect(botInput(s, 'p1', createRng(1), skill)).toMatchObject({ type: 'steer', x: -1, y: 0 });
    expect(botInput(s, 'p1', createRng(1), 'easy')).toMatchObject({ type: 'steer', x: 1, y: 0 });
    expect(botInput(s, 'unknown', createRng(1))).toBeNull();
  });

  it('sharp bots split only while aimed at prey small enough for each half', () => {
    const s = stateWithWorld(
      world([cell('p1', { mass: 96 }), cell('p2', { id: 2, x: 70, mass: 24 })], {
        time: 2000,
        controls: { p1: { x: 1, y: 0, at: 0, splitAt: 0 }, p2: { x: 0, y: 0, at: 0, splitAt: 0 } },
      }),
    );
    const splitSeeds = Array.from({ length: 20 }, (_, seed) =>
      botInput(s, 'p1', createRng(seed), 'sharp'),
    );
    expect(splitSeeds.some((input) => input?.type === 'split')).toBe(true);
    const unsafe = {
      ...s,
      world: { ...s.world, cells: [s.world.cells[0]!, { ...s.world.cells[1]!, mass: 45 }] },
    };
    expect(
      Array.from({ length: 20 }, (_, seed) =>
        botInput(unsafe, 'p1', createRng(seed), 'sharp'),
      ).every((input) => input?.type !== 'split'),
    ).toBe(true);
    expect(game.inputSchema.safeParse(botInput(s, 'p1', createRng(1), 'sharp')).success).toBe(true);
    expect(distance(s.world.cells[0]!, s.world.cells[1]!)).toBe(10);
  });

  it('ineligible bot seats consume no supplied RNG at every strength', () => {
    const initial = stateWithWorld(world([cell()], { pellets: [{ id: 0, x: 70, y: 50 }] }));
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const disconnected = {
        ...initial,
        players: { ...initial.players, p1: { ...initial.players.p1!, connected: false } },
      };
      const seats: [State, string][] = [
        [disconnected, 'p1'],
        [{ ...initial, left: ['p1'] }, 'p1'],
        [initial, 'spectator'],
        [initial, '__proto__'],
        [initial, 'constructor'],
      ];
      for (const [state, id] of seats) {
        const rng = createRng(23);
        const before = rng.state();
        expect(botInput(state, id, rng, skill)).toBeNull();
        expect(rng.state()).toEqual(before);
      }
    }
  });
});
