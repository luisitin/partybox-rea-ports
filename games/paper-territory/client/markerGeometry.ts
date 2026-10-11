import type { Direction } from '../server/types';

type Point = readonly [number, number];

const CARDINAL_VECTORS: readonly [Point, Point, Point, Point] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function markerGeometry(compact: boolean): { radius: number; ringRadius: number } {
  return compact ? { radius: 0.95, ringRadius: 1.2 } : { radius: 0.8, ringRadius: 1.12 };
}

// Small triangles sit beyond the numbered disc, pointing along absolute board axes.
export function headingTriangle(dir: Direction, radius: number): string {
  const [dx, dy] = CARDINAL_VECTORS[dir];
  const base = radius + 0.18;
  const tip = radius + 0.72;
  const halfWidth = 0.32;
  const vertices: readonly [Point, Point, Point] = [
    [dx * base - dy * halfWidth, dy * base + dx * halfWidth],
    [dx * tip, dy * tip],
    [dx * base + dy * halfWidth, dy * base - dx * halfWidth],
  ];
  return vertices.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}
