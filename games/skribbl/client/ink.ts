import type { Input, Stroke } from '../server/types';

export type InkOperation = Extract<Input, { type: 'stroke' | 'clear' | 'undo' }>;
export interface PendingInk {
  revision: number;
  input: InkOperation;
}

/** Replay unacknowledged operations in socket order, including edits between drawing chunks. */
export function previewInk(strokes: Stroke[], pending: PendingInk[]): Stroke[] {
  let picture = [...strokes];
  for (const { input } of pending) {
    if (input.type === 'clear') picture = [];
    else if (input.type === 'undo') {
      const last = picture.at(-1);
      let end = picture.length - 1;
      if (last?.gesture !== undefined) {
        while (end > 0 && picture[end - 1]?.gesture === last.gesture) end--;
      }
      picture = picture.slice(0, Math.max(0, end));
    } else {
      const stroke = input.stroke;
      const last = picture.at(-1);
      if (
        stroke.gesture !== undefined &&
        last?.gesture === stroke.gesture &&
        last.color === stroke.color &&
        last.width === stroke.width
      ) {
        picture[picture.length - 1] = {
          ...last,
          points: [...last.points, ...stroke.points.slice(1)],
        };
      } else picture.push(stroke);
    }
  }
  return picture;
}

export function gestureCount(strokes: Stroke[]): number {
  return strokes.filter(
    (stroke, index) =>
      stroke.gesture === undefined || index === 0 || stroke.gesture !== strokes[index - 1]?.gesture,
  ).length;
}

/** Refresh starts above known IDs; bounded wrap skips every stored or unacknowledged gesture. */
export function nextGesture(strokes: Stroke[], pending: PendingInk[], serial: number): number {
  let highest = serial;
  const occupied = new Set<number>();
  const remember = (stroke: Stroke): void => {
    if (stroke.gesture === undefined) return;
    occupied.add(stroke.gesture);
    highest = Math.max(highest, stroke.gesture);
  };
  for (const stroke of strokes) remember(stroke);
  for (const { input } of pending) {
    if (input.type === 'stroke') remember(input.stroke);
  }
  let candidate = highest >= 1_000_000_000 ? 0 : highest + 1;
  while (occupied.has(candidate)) candidate = candidate >= 1_000_000_000 ? 0 : candidate + 1;
  return candidate;
}
