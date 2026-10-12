import { describe, expect, it } from 'vitest';
import { boxesOverlap, placeLabels } from './labels';
import { radius } from '../server/geometry';

describe('arena identity labels', () => {
  it('keeps 32 crowded compact-board identities distinct and inside the arena without changing source poses', () => {
    const points = Array.from({ length: 32 }, (_, id) => ({ id, x: 80, y: 50 }));
    const original = structuredClone(points);
    const labels = placeLabels(points, 15.6, 15.6);
    expect(points).toEqual(original);
    expect(labels.map((label) => label.id)).toEqual(points.map((point) => point.id));
    for (const [index, label] of labels.entries()) {
      expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
      expect(label.x + label.width / 2).toBeLessThanOrEqual(160);
      expect(label.y - label.height / 2).toBeGreaterThanOrEqual(0);
      expect(label.y + label.height / 2).toBeLessThanOrEqual(100);
      for (const other of labels.slice(index + 1)) expect(boxesOverlap(label, other)).toBe(false);
    }
  });
  it('puts names clear of numbered plates even when all players are close together', () => {
    const points = Array.from({ length: 8 }, (_, id) => ({ id, x: 80, y: 50 }));
    const numbers = placeLabels(points, 9.36, 9.36);
    const names = placeLabels(points, 36, 8.6, numbers);
    for (const [index, name] of names.entries()) {
      for (const number of numbers) expect(boxesOverlap(name, number)).toBe(false);
      for (const other of names.slice(index + 1)) expect(boxesOverlap(name, other)).toBe(false);
    }
  });
  it('preserves the received center when an uncrowded label fits and clamps edge labels', () => {
    expect(placeLabels([{ id: 1, x: 80, y: 50 }], 10, 10)[0]).toMatchObject({ x: 80, y: 50 });
    expect(placeLabels([{ id: 2, x: 0, y: 100 }], 10, 10)[0]).toMatchObject({ x: 5, y: 95 });
  });
  it.each([5.46, 9.36, 15.6])(
    'keeps numbered plates outside starting/grown bodies and spawn shields at plate width %s',
    (width) => {
      const cells = [
        { id: 1, x: 40, y: 50, mass: 24, shield: 0 },
        { id: 2, x: 100, y: 50, mass: 60, shield: 0.9 },
      ];
      const bodies = cells.map((cell) => ({
        ...cell,
        width: (radius(cell.mass) + cell.shield + 0.4) * 2,
        height: (radius(cell.mass) + cell.shield + 0.4) * 2,
      }));
      const labels = placeLabels(cells, width, width, bodies);
      for (const label of labels)
        for (const body of bodies) expect(boxesOverlap(label, body)).toBe(false);
      expect(boxesOverlap(labels[0]!, labels[1]!)).toBe(false);
    },
  );
  it('keeps every one of 32 compact-board identity plates clear of a crowded physical-cell cluster', () => {
    const points = Array.from({ length: 32 }, (_, id) => ({ id, x: 80, y: 50 }));
    const bodies = points.map((point) => ({
      ...point,
      width: (radius(60) + 0.9 + 0.4) * 2,
      height: (radius(60) + 0.9 + 0.4) * 2,
    }));
    const labels = placeLabels(points, 15.6, 15.6, bodies);
    for (const [index, label] of labels.entries()) {
      for (const body of bodies) expect(boxesOverlap(label, body)).toBe(false);
      for (const other of labels.slice(index + 1)) expect(boxesOverlap(label, other)).toBe(false);
    }
  });
});
