// Adversarial geometry and crowded-arena rewards, with complete spatial bodies.
import { seedRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { pointSegment2 } from './geometry';
import {
  BODY_SPACING,
  BOOST_COST,
  BOOST_SPEED,
  FOOD_COUNT,
  MAX_FOOD,
  MAX_MASS,
  MIN_MASS,
  RADIUS,
  SPEED,
  START_MASS,
  STEP_MS,
  W,
} from './types';
import type { Point, Snake, World } from './types';
import { move, spawn, tick } from './world';

function straight(id: string, head: Point, angle: number, mass = START_MASS, boost = false): Snake {
  return {
    id,
    body: Array.from({ length: Math.ceil(mass) }, (_, i): Point => [
      head[0] - Math.cos(angle) * i * BODY_SPACING,
      head[1] - Math.sin(angle) * i * BODY_SPACING,
    ]),
    angle,
    target: angle,
    boost,
    mass,
    respawnAt: null,
    safeUntil: 0,
    crashes: 0,
  };
}

const arena = (snakes: Snake[]): World => ({
  snakes,
  food: Array.from({ length: FOOD_COUNT }, () => ({ x: 4, y: 4, value: 1 })),
  elapsed: 0,
});
const judged = (world: World): World => tick(world, seedRng(19), STEP_MS, {})[0];
const bodyLength = (body: Point[]): number =>
  body.slice(1).reduce((sum, point, i) => {
    const previous = body[i]!;
    return sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);

describe('arena fairness under crowded geometry', () => {
  it('head contact kills both even when one also hits a wall, in either seat order', () => {
    const a = straight('wall-head', [155.8, 50], 0, START_MASS, true);
    const b = straight('rival-head', [158.4, 54.1], -Math.PI / 2);
    for (const snakes of [
      [a, b],
      [b, a],
    ]) {
      const world = judged(arena(snakes));
      expect(world.snakes.every((s) => s.respawnAt !== null)).toBe(true);
      expect(world.snakes.every((s) => s.crashes === 1)).toBe(true);
    }
  });

  it('boost spends mass without stretching the collision body', () => {
    const source = straight('runner', [100, 50], 0, 50);
    const normal = move(source);
    const boosted = move({ ...source, boost: true });
    const physicalLength = 49 * BODY_SPACING;
    expect(normal.body[0]?.[0]).toBeCloseTo(100 + (SPEED * STEP_MS) / 1000, 3);
    expect(boosted.body[0]?.[0]).toBeCloseTo(100 + (BOOST_SPEED * STEP_MS) / 1000, 3);
    expect(boosted.mass).toBeCloseTo(50 - BOOST_COST, 3);
    expect(bodyLength(normal.body)).toBeCloseTo(physicalLength, 3);
    expect(bodyLength(boosted.body)).toBeCloseTo(physicalLength, 3);
    expect(boosted.body).toHaveLength(Math.ceil(boosted.mass));
  });

  it('eight simultaneous large corpses retain every owner’s mass after the food cap', () => {
    const rows = Array.from({ length: 8 }, (_, i) => 8 + i * 12);
    const sources = rows.map((y, i) => straight(`snake-${i}`, [W - RADIUS - 0.1, y], 0, MAX_MASS));
    for (const snakes of [sources, [...sources].reverse()]) {
      const world = judged(arena(snakes));
      expect(world.snakes.every((s) => s.respawnAt !== null)).toBe(true);
      expect(world.food.length).toBeLessThanOrEqual(MAX_FOOD);
      const corpseFood = world.food.filter((f) => rows.includes(f.y));
      expect(corpseFood.reduce((sum, f) => sum + f.value, 0)).toBeCloseTo(8 * MAX_MASS, 3);
      for (const y of rows) {
        const value = corpseFood.filter((f) => f.y === y).reduce((sum, f) => sum + f.value, 0);
        expect(value).toBeCloseTo(MAX_MASS, 3);
      }
    }
  });

  it('a returning snake avoids an occupied spawn body', () => {
    const occupied = spawn('blocker', 0, 2, 0, 1);
    const returning: Snake = {
      ...spawn('returning', 0, 2, 0, 1),
      body: [],
      mass: MIN_MASS,
      respawnAt: STEP_MS,
    };
    const source = arena([returning, { ...occupied, safeUntil: 0 }]);
    const world = judged(source);
    const fresh = world.snakes.find((s) => s.id === 'returning')!;
    const blocker = world.snakes.find((s) => s.id === 'blocker')!;
    expect(fresh.respawnAt).toBeNull();
    expect(fresh.mass).toBe(START_MASS);
    expect(fresh.body).toHaveLength(START_MASS);
    for (const point of fresh.body) {
      for (let i = 1; i < blocker.body.length; i++) {
        expect(pointSegment2(point, blocker.body[i - 1]!, blocker.body[i]!)).toBeGreaterThan(
          (2 * RADIUS) ** 2,
        );
      }
    }
    expect(judged(source)).toEqual(world);
  });
});
