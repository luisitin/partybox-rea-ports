// Swept collision distances prevent a boosting head tunnelling through a body.
import type { Point } from './types';

export const rounded = (x: number): number => Math.round(x * 1000) / 1000 || 0;
export const angleDelta = (a: number, b: number): number =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const distance2 = (a: Point, b: Point): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function pointSegment2(p: Point, a: Point, b: Point): number {
  const d = distance2(a, b);
  const t =
    d === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / d),
        );
  return distance2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}

export function segmentDistance2(a: Point, b: Point, c: Point, d: Point): number {
  const cross = (p: Point, q: Point, r: Point): number =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return 0;
  return Math.min(
    pointSegment2(a, c, d),
    pointSegment2(b, c, d),
    pointSegment2(c, a, b),
    pointSegment2(d, a, b),
  );
}
