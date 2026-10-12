import { describe, expect, it } from 'vitest';
import { gestureCount, previewInk } from './ink';
import type { InkOperation, PendingInk } from './ink';
import {
  activeInkTail,
  clearInkPackets,
  emptyInkPackets,
  reconcileInkPackets,
  takeInkPacket,
} from './inkPackets';
import { strokeSchema } from '../server/types';
import type { Stroke } from '../server/types';

const line = (gesture: number, x: number): Stroke => ({
  gesture,
  color: 0,
  width: 9,
  points: [
    [x, 100],
    [x + 10, 100],
  ],
});
const op = (revision: number, input: InkOperation): PendingInk => ({ revision, input });

describe('ink held through an ordinary VIP pause', () => {
  it('snapshots only dirty active fragments before releasing pointer capture', () => {
    const active = { ...line(1, 100), id: 9, dirty: true };
    const tail = activeInkTail(active)!;
    expect(tail).toEqual(line(1, 100));
    expect(tail.points).not.toBe(active.points);
    expect(activeInkTail({ ...active, dirty: false })).toBeUndefined();
    expect(activeInkTail({ ...active, id: -1 })).toBeUndefined();
    expect(activeInkTail({ ...active, points: [] })).toBeUndefined();
  });
  it('keeps unsent edits and a frozen tail in order, excluding already-sent optimistic ink', () => {
    const authoritative = [line(1, 10)];
    const ambiguous = op(11, { type: 'stroke', stroke: line(2, 30) });
    const unsent = [
      op(12, { type: 'undo' }),
      op(13, { type: 'clear' }),
      op(14, { type: 'stroke', stroke: line(3, 100) }),
    ];
    const tail = line(3, 110);
    const snapshot = reconcileInkPackets({
      queue: { operations: unsent, sentAt: 1_000 },
      pending: [ambiguous, ...unsent],
      inkRevision: 10,
      previousRevision: 10,
      paused: true,
      wasPaused: false,
      tail,
    });
    expect(snapshot.pending).toBe(snapshot.queue.operations);
    expect(snapshot.pending.map((operation) => operation.revision)).toEqual([11, 12, 13, 14]);
    expect(snapshot.pending.map((operation) => operation.input.type)).toEqual([
      'undo',
      'clear',
      'stroke',
      'stroke',
    ]);
    expect(snapshot.pending).not.toContain(ambiguous);
    expect(snapshot.pending[2]!.input).toBe(unsent[2]!.input);
    const picture = previewInk(authoritative, snapshot.pending);
    expect(picture).toEqual([
      {
        ...line(3, 100),
        points: [
          [100, 100],
          [110, 100],
          [120, 100],
        ],
      },
    ]);
    expect(gestureCount(picture)).toBe(1);
    expect(picture).toHaveLength(1);
    expect(snapshot.queue.sentAt).toBe(1_000);
    expect(snapshot.nextRevision).toBe(14);
    expect(unsent.map((operation) => operation.revision)).toEqual([12, 13, 14]);
    expect(tail.points).toEqual([
      [110, 100],
      [120, 100],
    ]);
  });

  it('preserves the dirty finger endpoint within the schema without adding a second tail on paused updates', () => {
    const tail: Stroke = {
      ...line(7, 0),
      points: Array.from({ length: 100 }, (_, i) => [i * 5, i * 3]),
    };
    const snapshot = reconcileInkPackets({
      queue: emptyInkPackets(),
      pending: [],
      inkRevision: 50,
      previousRevision: 50,
      paused: true,
      wasPaused: false,
      tail,
    });
    const input = snapshot.pending[0]!.input;
    if (input.type !== 'stroke') throw new Error('Expected frozen finger stroke');
    expect(input.stroke.points).toHaveLength(24);
    expect(input.stroke.points[0]).toEqual([0, 0]);
    expect(input.stroke.points.at(-1)).toEqual([495, 297]);
    expect(input.stroke.gesture).toBe(7);
    expect(strokeSchema.safeParse(input.stroke).success).toBe(true);
    expect(tail.points).toHaveLength(100);
    const updated = reconcileInkPackets({
      queue: snapshot.queue,
      pending: snapshot.pending,
      inkRevision: 52,
      previousRevision: 50,
      paused: true,
      wasPaused: true,
      tail,
    });
    expect(updated.pending).toHaveLength(1);
    expect(updated.pending[0]!.revision).toBe(53);
    expect(updated.pending[0]!.input).toBe(input);
  });

  it('rebases every known-unsent packet above late authoritative acknowledgements while paused and on resume', () => {
    const operations = [
      op(11, { type: 'stroke', stroke: line(1, 10) }),
      op(12, { type: 'undo' }),
      op(13, { type: 'clear' }),
      op(14, { type: 'stroke', stroke: line(2, 30) }),
    ];
    const paused = reconcileInkPackets({
      queue: { operations, sentAt: 5_000 },
      pending: operations,
      inkRevision: 13,
      previousRevision: 10,
      paused: true,
      wasPaused: true,
    });
    expect(paused.pending.map((operation) => operation.revision)).toEqual([14, 15, 16, 17]);
    expect(paused.pending.map((operation) => operation.input)).toEqual(
      operations.map((operation) => operation.input),
    );
    const resumed = reconcileInkPackets({
      queue: paused.queue,
      pending: paused.pending,
      inkRevision: 14,
      previousRevision: 13,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending.map((operation) => operation.revision)).toEqual([15, 16, 17, 18]);
    expect(resumed.nextRevision).toBe(18);
    expect(resumed.queue.sentAt).toBe(5_000);
    expect(takeInkPacket(resumed.queue, 5_079).operation).toBeUndefined();
    const first = takeInkPacket(resumed.queue, 5_080);
    expect(first.operation?.input).toBe(operations[0]!.input);
    expect(first.operation?.revision).toBe(15);
    expect(takeInkPacket(first.queue, 5_159).operation).toBeUndefined();
    expect(takeInkPacket(first.queue, 5_160).operation?.input.type).toBe('undo');
    const acknowledged = reconcileInkPackets({
      queue: first.queue,
      pending: resumed.pending,
      inkRevision: 15,
      previousRevision: 14,
      paused: false,
      wasPaused: false,
    });
    expect(acknowledged.pending.map((operation) => operation.revision)).toEqual([16, 17, 18]);
    expect(acknowledged.queue).toBe(first.queue);
  });

  it.each(['undo', 'clear', 'stroke'] as const)(
    'never resends an ambiguous sent %s operation',
    (type) => {
      const input: InkOperation = type === 'stroke' ? { type, stroke: line(2, 100) } : { type };
      const ambiguous = op(11, input);
      const paused = reconcileInkPackets({
        queue: { operations: [], sentAt: 1_000 },
        pending: [ambiguous],
        inkRevision: 10,
        previousRevision: 10,
        paused: true,
        wasPaused: false,
      });
      expect(paused.pending).toEqual([]);
      expect(paused.queue.operations).toEqual([]);
      expect(previewInk([line(1, 10)], paused.pending)).toEqual([line(1, 10)]);
      const resumed = reconcileInkPackets({
        queue: paused.queue,
        pending: paused.pending,
        inkRevision: 10,
        previousRevision: 10,
        paused: false,
        wasPaused: true,
      });
      expect(takeInkPacket(resumed.queue, 5_000).operation).toBeUndefined();
    },
  );

  it('discards the retained queue and tail on a backward revision reset, including during pause', () => {
    const operations = [op(41, { type: 'stroke', stroke: line(1, 0) })];
    const reset = reconcileInkPackets({
      queue: { operations, sentAt: 1_000 },
      pending: operations,
      inkRevision: 0,
      previousRevision: 40,
      paused: true,
      wasPaused: false,
      tail: line(2, 100),
    });
    expect(reset.pending).toEqual([]);
    expect(reset.queue.operations).toEqual([]);
    expect(reset.nextRevision).toBe(0);
    expect(reset.queue.sentAt).toBe(1_000);
  });

  it('clears retained work at unmount/new turn instead of allowing it into a later drawing', () => {
    const paused = reconcileInkPackets({
      queue: emptyInkPackets(),
      pending: [],
      inkRevision: 0,
      previousRevision: 0,
      paused: true,
      wasPaused: false,
      tail: line(1, 100),
    });
    const discarded = clearInkPackets(paused.queue);
    expect(takeInkPacket(discarded, 10_000).operation).toBeUndefined();
    expect(takeInkPacket(emptyInkPackets(), 10_000).operation).toBeUndefined();
  });
});
