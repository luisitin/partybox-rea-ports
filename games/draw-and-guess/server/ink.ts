// Keep a live drawing within the SDK's 64 KiB view budget without dropping whole gestures.
import type { Point, Stroke } from './types';
export const MAX_POINTS = 3500;
export function continuesInk(strokes: Stroke[], stroke: Stroke): boolean {
  const last = strokes.at(-1);
  return (
    stroke.gesture !== undefined &&
    last?.gesture === stroke.gesture &&
    last.color === stroke.color &&
    last.width === stroke.width
  );
}
export function appendInk(strokes: Stroke[], input: Stroke): Stroke[] {
  const stroke: Stroke = {
    ...input,
    points: input.points.map(([x, y]) => [Math.round(x), Math.round(y)]),
  };
  if (!continuesInk(strokes, stroke)) return compactInk([...strokes, stroke]);
  const last = strokes.at(-1)!;
  const tail = last.points.at(-1)!;
  const first = stroke.points[0]!;
  const points = [
    ...last.points,
    ...stroke.points.slice(tail[0] === first[0] && tail[1] === first[1] ? 1 : 0),
  ];
  return compactInk([...strokes.slice(0, -1), { ...last, points }]);
}
export function undoInk(strokes: Stroke[]): Stroke[] {
  const gesture = strokes.at(-1)?.gesture;
  let end = strokes.length - 1;
  if (gesture !== undefined) while (end > 0 && strokes[end - 1]?.gesture === gesture) end--;
  return strokes.slice(0, Math.max(0, end));
}
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
