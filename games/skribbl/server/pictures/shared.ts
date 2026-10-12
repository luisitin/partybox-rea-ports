// Pure path constructors shared by the original difficulty pictograms.
import type { Point, Stroke } from '../types';
const line = (coords: number[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < coords.length; i += 2) out.push([coords[i] ?? 0, coords[i + 1] ?? 0]);
  return out;
};
export const circle = (x: number, y: number, r: number): Point[] =>
  Array.from({ length: 21 }, (_, i): Point => [
    Math.round(x + r * Math.cos((i * Math.PI) / 10)),
    Math.round(y + r * Math.sin((i * Math.PI) / 10)),
  ]);
export const shape = (...paths: Point[][]): Stroke[] =>
  paths.map((points) => ({ points, color: 0, width: 9 }));
export const l = (...coords: number[]): Point[] => line(coords);
