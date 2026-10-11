// Bounded optimistic ink, independent of React and the pointer API so real wire inputs can be tested.
import { MAX_POINTS, MAX_STROKES } from '../server/types';
import type { Input, Stroke } from '../server/types';

interface Source {
  strokes: Stroke[];
  nextSeq: number;
  nextStroke: number;
  paused?: boolean;
}

interface Gesture {
  id: number;
  color: number;
  size: Stroke['size'];
  points: Stroke['points'];
}

export class StrokeStream {
  private source: Source;
  private sequence: number;
  private strokeId: number;
  private pending: Stroke[] = [];
  private gesture: Gesture | null = null;

  constructor(
    source: Source,
    private readonly send: (input: Input) => void,
  ) {
    this.source = source;
    this.sequence = source.nextSeq;
    this.strokeId = source.nextStroke;
  }

  sync(source: Source): void {
    this.source = source;
    this.sequence = Math.max(this.sequence, source.nextSeq);
    this.strokeId = Math.max(this.strokeId, source.nextStroke);
    this.pending = this.pending.filter((stroke) => stroke.seq >= source.nextSeq);
    if (source.paused) this.gesture = null;
  }

  get strokes(): Stroke[] {
    const active = this.gesture;
    return [
      ...this.source.strokes,
      ...this.pending,
      ...(active && active.points.length > 1
        ? [
            {
              id: active.id,
              seq: this.sequence,
              color: active.color,
              size: active.size,
              points: [...active.points],
            },
          ]
        : []),
    ];
  }

  private get used(): { points: number; chunks: number } {
    const all = [...this.source.strokes, ...this.pending];
    return {
      points: all.reduce((sum, stroke) => sum + stroke.points.length, 0),
      chunks: all.length,
    };
  }

  get full(): boolean {
    const used = this.used;
    return used.points >= MAX_POINTS || used.chunks >= MAX_STROKES;
  }

  private flush(): boolean {
    const active = this.gesture;
    if (!active) return false;
    const used = this.used;
    if (used.chunks >= MAX_STROKES || used.points + active.points.length > MAX_POINTS) return false;
    const stroke: Stroke = {
      id: active.id,
      seq: this.sequence++,
      color: active.color,
      size: active.size,
      points: [...active.points],
    };
    this.pending.push(stroke);
    active.points = [active.points[active.points.length - 1] ?? [0, 0]];
    this.send({ type: 'stroke', stroke });
    return true;
  }

  begin(point: [number, number], color: number, size: Stroke['size']): boolean {
    if (this.source.paused || this.gesture || this.full) return false;
    this.gesture = { id: this.strokeId++, color, size, points: [point] };
    return this.flush();
  }

  move(point: [number, number]): void {
    const active = this.gesture;
    if (!active || this.source.paused) return;
    const last = active.points[active.points.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 4) return;
    const used = this.used;
    if (used.chunks >= MAX_STROKES || used.points + active.points.length + 1 > MAX_POINTS) return;
    active.points.push(point);
    if (active.points.length >= 8) this.flush();
  }

  end(): void {
    if (!this.source.paused && this.gesture && this.gesture.points.length > 1) this.flush();
    this.gesture = null;
  }

  edit(type: 'undo' | 'clear'): void {
    if (this.source.paused) return;
    this.end();
    this.pending = [];
    this.send({ type });
  }
}
