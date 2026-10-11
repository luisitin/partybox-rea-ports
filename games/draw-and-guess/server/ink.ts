// Keep a live drawing within the SDK's 64 KiB view budget without dropping whole gestures.
import type { Point, Stroke } from './types';
export const MAX_POINTS = 3500;
export function compactInk(strokes: Stroke[]): Stroke[] {
  let points = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (points <= MAX_POINTS) return strokes;
  const out = [...strokes];
  while (points > MAX_POINTS) {
    let index = 0;
    for (let i = 1; i < out.length; i++)
      if (out[i]!.points.length > out[index]!.points.length) index = i;
    const stroke = out[index]!;
    const simplified: Point[] = stroke.points.filter(
      (_, i) => i % 2 === 0 || i === stroke.points.length - 1,
    );
    points -= stroke.points.length - simplified.length;
    out[index] = { ...stroke, points: simplified };
  }
  return out;
}
