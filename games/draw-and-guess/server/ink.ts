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

/** Lossless cleanup: retain every corner and every reversal along a straight line. */
function withoutCollinear(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    while (out.length >= 2) {
      const a = out[out.length - 2]!;
      const b = out[out.length - 1]!;
      const abX = b[0] - a[0];
      const abY = b[1] - a[1];
      const bcX = point[0] - b[0];
      const bcY = point[1] - b[1];
      if (abX * bcY !== abY * bcX || abX * bcX + abY * bcY < 0) break;
      out.pop();
    }
    out.push(point);
  }
  return out;
}

interface Candidate {
  index: number;
  revision: number;
  error: number;
}

/** Remove the least visible bends first, with index-stable ties and O(n log n) work. */
function simplify(points: Point[], target: number): Point[] {
  const before = Int32Array.from(points, (_, i) => i - 1);
  const after = Int32Array.from(points, (_, i) => i + 1);
  const revisions = new Uint32Array(points.length);
  const removed = new Uint8Array(points.length);
  const heap: Candidate[] = [];
  const earlier = (a: Candidate, b: Candidate): boolean =>
    a.error < b.error || (a.error === b.error && a.index < b.index);
  const push = (entry: Candidate): void => {
    let i = heap.length;
    heap.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!earlier(entry, heap[parent]!)) break;
      heap[i] = heap[parent]!;
      i = parent;
    }
    heap[i] = entry;
  };
  const pop = (): Candidate => {
    const first = heap[0]!;
    const last = heap.pop()!;
    if (!heap.length) return first;
    let i = 0;
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1;
      if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) child++;
      if (!earlier(heap[child]!, last)) break;
      heap[i] = heap[child]!;
      i = child;
    }
    heap[i] = last;
    return first;
  };
  const enqueue = (index: number): void => {
    if (index <= 0 || index >= points.length - 1) return;
    const a = points[before[index]!]!;
    const b = points[index]!;
    const c = points[after[index]!]!;
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / length))
      : 0;
    // Segment distance also protects a collinear cusp; triangle area alone treats it as zero.
    const error = (b[0] - a[0] - t * dx) ** 2 + (b[1] - a[1] - t * dy) ** 2;
    revisions[index] = revisions[index]! + 1;
    push({ index, revision: revisions[index]!, error });
  };
  for (let i = 1; i < points.length - 1; i++) enqueue(i);
  let count = points.length;
  while (count > target) {
    const candidate = pop();
    const i = candidate.index;
    if (removed[i] || candidate.revision !== revisions[i]) continue;
    removed[i] = 1;
    const a = before[i]!;
    const c = after[i]!;
    after[a] = c;
    before[c] = a;
    count--;
    enqueue(a);
    enqueue(c);
  }
  return points.filter((_, i) => !removed[i]);
}

export function compactInk(strokes: Stroke[]): Stroke[] {
  let points = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (points <= MAX_POINTS) return strokes;
  const out = strokes.map((stroke) => ({ ...stroke, points: withoutCollinear(stroke.points) }));
  points = out.reduce((sum, stroke) => sum + stroke.points.length, 0);
  while (points > MAX_POINTS) {
    let index = 0;
    for (let i = 1; i < out.length; i++)
      if (out[i]!.points.length > out[index]!.points.length) index = i;
    const stroke = out[index]!;
    const simplified = simplify(stroke.points, Math.max(2, Math.ceil(stroke.points.length / 2)));
    points -= stroke.points.length - simplified.length;
    out[index] = { ...stroke, points: simplified };
  }
  return out;
}
