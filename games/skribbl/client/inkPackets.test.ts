import { describe, expect, it } from 'vitest';
import { finishDrawingPoints } from './drawingGeometry';
import { previewInk } from './ink';
import type { PendingInk } from './ink';
import {
  boundInkPoints,
  clearInkPackets,
  emptyInkPackets,
  enqueueInkPacket,
  INK_PACKET_MS,
  takeInkPacket,
} from './inkPackets';
import { strokeSchema } from '../server/types';
import type { Point, Stroke } from '../server/types';

const dot = (gesture: number): Stroke => ({
  gesture,
  color: 0,
  width: 9,
  points: [[gesture, 30]],
});

describe('drawing transport pacing', () => {
  it('keeps high-rate dots and edits below the SDK limit in every rolling second', () => {
    let queue = emptyInkPackets();
    const deliveries: { at: number; operation: PendingInk }[] = [];
    let revision = 0;
    for (let at = 0; at <= 12_000; at += 5) {
      if (at < 1_000) {
        const input =
          revision % 3 === 0
            ? ({ type: 'clear' } as const)
            : revision % 3 === 1
              ? ({ type: 'stroke', stroke: dot(revision) } as const)
              : ({ type: 'undo' } as const);
        queue = enqueueInkPacket(queue, { revision: ++revision, input });
      }
      const packet = takeInkPacket(queue, at);
      queue = packet.queue;
      if (packet.operation) deliveries.push({ at, operation: packet.operation });
    }
    expect(deliveries.length).toBeGreaterThan(100);
    for (let i = 0; i < deliveries.length; i++) {
      const at = deliveries[i]!.at;
      expect(
        deliveries.filter((packet) => packet.at >= at && packet.at < at + 1_000).length,
      ).toBeLessThanOrEqual(13);
      if (i) expect(at - deliveries[i - 1]!.at).toBeGreaterThanOrEqual(INK_PACKET_MS);
      expect(deliveries[i]!.operation.revision).toBe(i + 1);
    }
  });

  it('keeps stroke, Undo and Clear order without merging their optimistic revisions', () => {
    const operations: PendingInk[] = [
      { revision: 1, input: { type: 'stroke', stroke: dot(1) } },
      { revision: 2, input: { type: 'undo' } },
      { revision: 3, input: { type: 'stroke', stroke: dot(2) } },
      { revision: 4, input: { type: 'clear' } },
      { revision: 5, input: { type: 'stroke', stroke: dot(3) } },
    ];
    let queue = operations.reduce(enqueueInkPacket, emptyInkPackets());
    const received: PendingInk[] = [];
    for (const at of [20, 100, 180, 260, 340]) {
      const packet = takeInkPacket(queue, at);
      queue = packet.queue;
      received.push(packet.operation!);
    }
    expect(received).toEqual(operations);
    expect(queue.operations).toEqual([]);
    expect(previewInk([], received)).toEqual([dot(3)]);
  });

  it('sends one packet after a long stall and waits a full interval before the next', () => {
    let queue = emptyInkPackets();
    for (let revision = 1; revision <= 4; revision++)
      queue = enqueueInkPacket(queue, { revision, input: { type: 'undo' } });
    const first = takeInkPacket(queue, 0);
    const late = takeInkPacket(first.queue, 5_000);
    expect(late.operation?.revision).toBe(2);
    expect(late.queue.operations.map((operation) => operation.revision)).toEqual([3, 4]);
    expect(takeInkPacket(late.queue, 5_000).operation).toBeUndefined();
    expect(takeInkPacket(late.queue, 5_079).operation).toBeUndefined();
    expect(takeInkPacket(late.queue, 5_080).operation?.revision).toBe(3);
    expect(queue.operations).toHaveLength(4);
  });

  it('drops turn/unmounted work without resetting the transport gate', () => {
    const sent = takeInkPacket(
      enqueueInkPacket(emptyInkPackets(), { revision: 1, input: { type: 'undo' } }),
      1_000,
    );
    const queued = enqueueInkPacket(sent.queue, { revision: 2, input: { type: 'clear' } });
    const cleared = clearInkPackets(queued);
    expect(cleared.operations).toEqual([]);
    expect(queued.operations).toHaveLength(1);
    const resumed = enqueueInkPacket(cleared, { revision: 2, input: { type: 'undo' } });
    expect(takeInkPacket(resumed, 1_079).operation).toBeUndefined();
    expect(takeInkPacket(resumed, 1_080).operation?.input.type).toBe('undo');
    expect(takeInkPacket(resumed, 999).operation).toBeUndefined();
    expect(takeInkPacket(resumed, NaN).operation).toBeUndefined();
  });
});

describe('bounded drawing samples', () => {
  const outline = (): Point[] => {
    const points: Point[] = [];
    for (let x = 0; x <= 1_000; x += 5) points.push([x, 0]);
    for (let y = 5; y <= 600; y += 5) points.push([1_000, y]);
    for (let x = 995; x >= 0; x -= 5) points.push([x, 600]);
    return points;
  };

  it('bounds a dense coalesced batch, keeping its endpoints and visible corners', () => {
    const points = outline();
    const original = points.map((point) => [...point]);
    const bounded = boundInkPoints(points);
    expect(bounded).toHaveLength(24);
    expect(bounded[0]).toEqual([0, 0]);
    expect(bounded.at(-1)).toEqual([0, 600]);
    expect(bounded).toContainEqual([1_000, 0]);
    expect(bounded).toContainEqual([1_000, 600]);
    expect(points).toEqual(original);
    expect(strokeSchema.safeParse({ ...dot(1), points: bounded }).success).toBe(true);
  });

  it('keeps a release-only tail when an already full packet gains a final coordinate', () => {
    const points = boundInkPoints(outline());
    const completed = finishDrawingPoints(points, 'pointerup', 100, 500, {
      left: 0,
      top: 0,
      width: 1_000,
      height: 600,
    });
    expect(completed).toHaveLength(25);
    const packet = boundInkPoints(completed);
    expect(packet).toHaveLength(24);
    expect(packet[0]).toEqual(points[0]);
    expect(packet.at(-1)).toEqual([100, 500]);
    expect(strokeSchema.safeParse({ ...dot(1), points: packet }).success).toBe(true);
  });

  it('protects a reversal along a straight line while shortening less visible samples', () => {
    const points: Point[] = [];
    for (let x = 0; x <= 1_000; x += 5) points.push([x, 300]);
    for (let x = 995; x >= 0; x -= 5) points.push([x, 300]);
    const bounded = boundInkPoints(points);
    expect(bounded).toHaveLength(24);
    expect(bounded).toContainEqual([1_000, 300]);
    expect(bounded[0]).toEqual([0, 300]);
    expect(bounded.at(-1)).toEqual([0, 300]);
  });

  it('does not change an ordinary packet or a single tap', () => {
    const points: Point[] = [
      [10, 20],
      [50, 60],
      [100, 150],
    ];
    expect(boundInkPoints(points)).toBe(points);
    const tap: Point[] = [[500, 300]];
    expect(boundInkPoints(tap)).toBe(tap);
  });
});
