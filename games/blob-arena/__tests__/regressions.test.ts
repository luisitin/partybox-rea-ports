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
});
