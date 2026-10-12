import type { Input, Stroke } from '../server/types';

export type InkOperation = Extract<Input, { type: 'stroke' | 'clear' | 'undo' }>;
export type InkUndoTarget = { gesture: number } | { stroke: Stroke } | { empty: true };
export interface PendingInk {
  revision: number;
  input: InkOperation;
  undoTarget?: InkUndoTarget;
}

/** Undo means the gesture visible at the tap, even if pause later rejects an earlier packet. */
export function pendingInkOperation(
  revision: number,
  input: InkOperation,
  picture: Stroke[],
): PendingInk {
  if (input.type !== 'undo') return { revision, input };
  const last = picture.at(-1);
  const undoTarget: InkUndoTarget = !last
    ? { empty: true }
    : last.gesture !== undefined
      ? { gesture: last.gesture }
      : {
          stroke: { ...last, points: last.points.map(([x, y]) => [Math.round(x), Math.round(y)]) },
        };
  return { revision, input, undoTarget };
}

/** Missing metadata preserves legacy operations; new Undo cannot erase a different last gesture. */
export function undoTargetsLast(picture: Stroke[], operation: PendingInk): boolean {
  const target = operation.undoTarget;
  if (!target) return true;
  const last = picture.at(-1);
  if ('empty' in target) return last === undefined;
  if ('gesture' in target) return last?.gesture === target.gesture;
  const stroke = target.stroke;
  return (
    last !== undefined &&
    last.gesture === undefined &&
    last.color === stroke.color &&
    last.width === stroke.width &&
    last.points.length === stroke.points.length &&
    last.points.every(
      ([x, y], index) =>
        Math.round(x) === stroke.points[index]![0] && Math.round(y) === stroke.points[index]![1],
    )
  );
}

/** Resolve held Undo intents against the final resume picture and preceding retained operations. */
export function dropMissingUndoTargets(strokes: Stroke[], operations: PendingInk[]): PendingInk[] {
  let picture = strokes;
  const retained: PendingInk[] = [];
  for (const operation of operations) {
    if (operation.input.type === 'undo' && !undoTargetsLast(picture, operation)) continue;
    retained.push(operation);
    picture = previewInk(picture, [operation]);
  }
  return retained;
}

/** Replay unacknowledged operations in socket order, including edits between drawing chunks. */
export function previewInk(strokes: Stroke[], pending: PendingInk[]): Stroke[] {
  let picture = [...strokes];
  for (const operation of pending) {
    const { input } = operation;
    if (input.type === 'clear') picture = [];
    else if (input.type === 'undo') {
      if (!undoTargetsLast(picture, operation)) continue;
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
