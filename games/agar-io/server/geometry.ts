// Geometry shared with the SVG stage. Larger cells trade speed for reach.
import { H, START_MASS, W } from './types';
import type { Cell } from './types';

export const radius = (mass: number): number => Math.min(24, Math.sqrt(mass) * 0.55);
export const speed = (mass: number): number => Math.max(6, 20 * (mass / START_MASS) ** -0.23);
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const round = (n: number): number => Math.round(n * 10000) / 10000;
export const bound = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
export function clampCell(cell: Cell): Cell {
  const r = radius(cell.mass);
  return { ...cell, x: round(bound(cell.x, r, W - r)), y: round(bound(cell.y, r, H - r)) };
}
