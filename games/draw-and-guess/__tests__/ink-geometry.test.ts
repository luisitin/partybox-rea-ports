import { describe, expect, it } from 'vitest';
import { compactInk, MAX_POINTS, undoInk } from '../server/ink';
import type { Point, Stroke } from '../server/types';
import { deepFreeze, jsonBytes } from './helpers';

const stroke = (points: Point[]): Stroke => ({ points, color: 2, width: 9, gesture: 42 });
const oldHalving = (points: Point[]): Point[] =>
  points.filter((_, i) => i % 2 === 0 || i === points.length - 1);

/** Maximum distance from the original trace to the nearest simplified line segment. */
function maxDeviation(original: Point[], simplified: Point[]): number {
  let worst = 0;
  for (const point of original) {
    let nearest = Infinity;
    for (let i = 1; i < simplified.length; i++) {
      const a = simplified[i - 1]!;
      const b = simplified[i]!;
      const vx = b[0] - a[0];
      const vy = b[1] - a[1];
      const length = vx * vx + vy * vy;
      const position = length
        ? Math.max(0, Math.min(1, ((point[0] - a[0]) * vx + (point[1] - a[1]) * vy) / length))
        : 0;
      const dx = point[0] - a[0] - position * vx;
      const dy = point[1] - a[1] - position * vy;
      nearest = Math.min(nearest, dx * dx + dy * dy);
    }
    worst = Math.max(worst, nearest);
  }
  return Math.sqrt(worst);
}

describe('geometry-preserving dense ink', () => {
  it('keeps an odd-index sharp tip that alternating-index halving erased', () => {
    const points = Array.from({ length: MAX_POINTS + 1 }, (_, i): Point => [
      i % 1001,
      i === 1751 ? 100 : 300,
    ]);
    const input = deepFreeze([stroke(points)]);
    const compacted = compactInk(input);
    const result = compacted[0]!.points;
    const before = maxDeviation(points, oldHalving(points));
    const after = maxDeviation(points, result);
    expect(before).toBe(200);
    expect(after).toBeLessThan(1e-9);
    expect(result).toContainEqual(points[1751]);
    expect(result.length).toBeLessThan(30);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
    expect(compacted[0]).toMatchObject({ color: 2, width: 9, gesture: 42 });
    expect(undoInk(compacted)).toEqual([]);
    expect(jsonBytes(compacted)).toBeLessThan(64 * 1024);
    expect(input[0]!.points).toHaveLength(MAX_POINTS + 1);
    console.info(`dense tip maximum deviation: ${before} -> ${after} logical pixels`);
  });

  it('uses the bounded heap for genuinely curved ink and retains its large bends', () => {
    const points = Array.from({ length: MAX_POINTS + 1 }, (_, i): Point => [
      i % 1001,
      i % 350 === 175 ? 100 : 300 + (i % 2),
    ]);
    const input = deepFreeze([stroke(points)]);
    const compacted = compactInk(input);
    const result = compacted[0]!.points;
    const before = maxDeviation(points, oldHalving(points));
    const after = maxDeviation(points, result);
    expect(before).toBe(200);
    expect(after).toBeLessThan(1);
    expect(result.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(result.length).toBeGreaterThan(1000);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
    for (let i = 175; i < points.length; i += 350) expect(result).toContainEqual(points[i]);
    expect(compactInk(input)).toEqual(compacted);
    const times = Array.from({ length: 20 }, () => {
      const began = performance.now();
      compactInk(input);
      return performance.now() - began;
    }).sort((a, b) => a - b);
    console.info(
      `dense curved maximum deviation: ${before} -> ${after.toFixed(3)} logical pixels; ` +
        `3501-point compaction median ${times[10]!.toFixed(2)} ms, p95 ${times[19]!.toFixed(2)} ms`,
    );
  });

  it('removes repeated/forward-collinear points while preserving direction reversals', () => {
    const corners: Point[] = [
      [0, 0],
      [1000, 0],
      [1000, 600],
      [1000, 0],
      [0, 0],
    ];
    const points = corners.slice(1).flatMap((b, index) => {
      const a = corners[index]!;
      return Array.from({ length: 1001 }, (_, step): Point => [
        Math.round(a[0] + ((b[0] - a[0]) * step) / 1000),
        Math.round(a[1] + ((b[1] - a[1]) * step) / 1000),
      ]);
    });
    const input = deepFreeze([stroke(points)]);
    const compacted = compactInk(input);
    expect(compacted[0]!.points).toEqual(corners);
    expect(input[0]!.points).toHaveLength(4004);
    expect(compactInk(compacted)).toBe(compacted);
  });
});
