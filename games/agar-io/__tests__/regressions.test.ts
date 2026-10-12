// Defects found during the independent mechanics review: input loss, walls, and tunnelling.
import { createRng, seedRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { botInput } from '../server/bot';
import { resolveCells } from '../server/collisions';
import { radius } from '../server/geometry';
import { apply, tick, totalMass } from '../server/world';
import { cell, stateWithWorld, world } from './helpers';

describe('review regressions', () => {
  it('accepts the final rapid pointer move and an immediate split after aiming', () => {
    const initial = world([cell('p1', { mass: 96 })]);
    const right = apply(initial, 'p1', { type: 'steer', x: 1, y: 0 }, 1);
    const up = apply(right, 'p1', { type: 'steer', x: 0, y: -1 }, 2);
    expect(up.controls.p1).toMatchObject({ x: 0, y: -1 });
    const split = apply(up, 'p1', { type: 'split' }, 3);
    expect(split.cells).toHaveLength(2);
    expect(split.cells[1]?.vy).toBe(-55);
  });
  it('escapes tangentially when a grown bot reaches its radius-aware left wall', () => {
    const me = cell('p1', { mass: 192, x: radius(192), y: 40 });
    const threat = cell('p2', { id: 2, mass: 500, x: 25, y: 40 });
    const state = stateWithWorld(world([me, threat], { time: 2000 }));
    const input = botInput(state, 'p1', createRng(1), 'normal');
    expect(input?.type).toBe('steer');
    expect(input).toMatchObject({ x: 0, y: 1 });
  });
  it('a split lunge eats edible prey it crosses between physics samples', () => {
    const initial = world([cell('p1', { mass: 60 }), cell('p2', { id: 2, x: 76, mass: 24 })], {
      serial: 3,
      controls: {
        p1: { x: 1, y: 0, at: 0, splitAt: -1000 },
        p2: { x: 0, y: 0, at: 0, splitAt: -1000 },
      },
    });
    const split = apply(initial, 'p1', { type: 'split' }, 1000);
    const [end] = tick({ ...split, time: 1000 }, seedRng(1), 1200);
    expect(end.cells.some((c) => c.owner === 'p2')).toBe(false);
    expect(totalMass(end, 'p1')).toBe(84);
  });
  it('a swept near miss stays a miss and spawn protection blocks a crossed prey', () => {
    const old = [cell('p1', { mass: 60, x: 60 }), cell('p2', { id: 2, x: 70, y: 60 })];
    const moved = [{ ...old[0]!, x: 80 }, old[1]!];
    expect(resolveCells(moved, 1000, old)).toHaveLength(2);
    const protectedOld = [old[0]!, { ...old[1]!, y: 50, shieldUntil: 1000 }];
    const protectedMoved = [{ ...old[0]!, x: 80 }, protectedOld[1]!];
    expect(resolveCells(protectedMoved, 999, protectedOld)).toHaveLength(2);
  });

  it('all bot strengths choose either tied snack reproducibly without storage-order preference', () => {
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (const right of [65, 65.0004]) {
        const state = stateWithWorld(
          world([cell()], {
            pellets: [
              { id: 1, x: 55, y: 50 },
              { id: 2, x: right, y: 50 },
            ],
          }),
        );
        const reversed = {
          ...state,
          world: { ...state.world, pellets: [...state.world.pellets].reverse() },
        };
        const directions = new Set<number>();
        for (let seed = 1; seed <= 64; seed++) {
          const input = botInput(state, 'p1', createRng(seed), skill);
          expect(input?.type).toBe('steer');
          expect(botInput(state, 'p1', createRng(seed), skill)).toEqual(input);
          expect(botInput(reversed, 'p1', createRng(seed), skill)).toEqual(input);
          if (input?.type === 'steer') directions.add(input.x);
        }
        expect([...directions].sort()).toEqual([-1, 1]);
      }
    }
  });

  it('normal and sharp bots flee either tied predator with canonical seeded target replay', () => {
    const state = stateWithWorld(
      world([
        cell(),
        cell('p2', { id: 2, x: 55, mass: 100 }),
        cell('p3', { id: 3, x: 65, mass: 100 }),
      ]),
    );
    const reversed = {
      ...state,
      world: { ...state.world, cells: [...state.world.cells].reverse() },
    };
    for (const skill of ['normal', 'sharp'] as const) {
      const directions = new Set<number>();
      for (let seed = 1; seed <= 64; seed++) {
        const input = botInput(state, 'p1', createRng(seed), skill);
        expect(input?.type).toBe('steer');
        expect(botInput(reversed, 'p1', createRng(seed), skill)).toEqual(input);
        if (input?.type === 'steer') directions.add(input.x);
      }
      expect([...directions].sort()).toEqual([-1, 1]);
    }
  });

  it('sharp bots can chase either equally edible rival and replay despite cell reordering', () => {
    const state = stateWithWorld(
      world([cell('p1', { mass: 96 }), cell('p2', { id: 2, x: 50 }), cell('p3', { id: 3, x: 70 })]),
    );
    const reversed = {
      ...state,
      world: { ...state.world, cells: [...state.world.cells].reverse() },
    };
    const directions = new Set<number>();
    for (let seed = 1; seed <= 64; seed++) {
      const input = botInput(state, 'p1', createRng(seed), 'sharp');
      expect(input?.type).toBe('steer');
      expect(botInput(state, 'p1', createRng(seed), 'sharp')).toEqual(input);
      expect(botInput(reversed, 'p1', createRng(seed), 'sharp')).toEqual(input);
      if (input?.type === 'steer') directions.add(input.x);
    }
    expect([...directions].sort()).toEqual([-1, 1]);
  });

  it('nearest-snack ties exclude a genuine distance difference without consuming RNG', () => {
    const state = stateWithWorld(
      world([cell()], {
        pellets: [
          { id: 1, x: 55, y: 50 },
          { id: 2, x: 65.002, y: 50 },
        ],
      }),
    );
    for (const skill of ['normal', 'sharp'] as const) {
      const rng = createRng(23);
      const before = rng.state();
      expect(botInput(state, 'p1', rng, skill)).toEqual({ type: 'steer', x: -1, y: 0 });
      expect(rng.state()).toEqual(before);
    }
  });

  it('easy snack variation includes every tie at its fifth-nearest cutoff', () => {
    const state = stateWithWorld(
      world([cell()], {
        pellets: [
          { id: 1, x: 55, y: 50 },
          { id: 2, x: 56, y: 47 },
          { id: 3, x: 56, y: 53 },
          { id: 4, x: 60, y: 45 },
          { id: 5, x: 60, y: 55 },
          { id: 6, x: 65, y: 50 },
        ],
      }),
    );
    const reversed = {
      ...state,
      world: { ...state.world, pellets: [...state.world.pellets].reverse() },
    };
    const actions = new Set<string>();
    for (let seed = 1; seed <= 128; seed++) {
      const input = botInput(state, 'p1', createRng(seed), 'easy');
      expect(input?.type).toBe('steer');
      expect(botInput(reversed, 'p1', createRng(seed), 'easy')).toEqual(input);
      actions.add(JSON.stringify(input));
    }
    expect(actions.size).toBe(6);
    expect(actions.has(JSON.stringify({ type: 'steer', x: 1, y: 0 }))).toBe(true);
  });
});
