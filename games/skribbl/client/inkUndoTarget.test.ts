import { describe, expect, it } from 'vitest';
import { pendingInkOperation, previewInk } from './ink';
import type { PendingInk } from './ink';
import { reconcileInkPackets, takeInkPacket } from './inkPackets';
import { game } from '../server/index';
import { inputSchema } from '../server/types';
import type { Stroke } from '../server/types';
import { drawing } from '../__tests__/helpers';

const line = (gesture: number): Stroke => ({
  gesture,
  color: 0,
  width: 9,
  points: [
    [gesture * 100, 100],
    [gesture * 100 + 10, 100],
  ],
});
const stroke = (revision: number, gesture: number): PendingInk => ({
  revision,
  input: { type: 'stroke', stroke: line(gesture) },
});

function heldUndo() {
  const authoritative = [line(1)];
  const sent = stroke(11, 2);
  const undo = pendingInkOperation(12, { type: 'undo' }, previewInk(authoritative, [sent]));
  const paused = reconcileInkPackets({
    queue: { operations: [undo], sentAt: 1_000 },
    pending: [sent, undo],
    inkRevision: 10,
    previousRevision: 10,
    paused: true,
    wasPaused: false,
    strokes: authoritative,
  });
  return { authoritative, sent, undo, paused };
}

describe('Undo retains its intended gesture across pause', () => {
  it('does not erase an older accepted gesture when the sent new gesture was rejected by pause', () => {
    const { authoritative, undo, paused } = heldUndo();
    expect(undo.undoTarget).toEqual({ gesture: 2 });
    expect(paused.pending).toHaveLength(1);
    expect(paused.pending[0]!.undoTarget).toBe(undo.undoTarget);
    expect(previewInk(authoritative, paused.pending)).toEqual(authoritative);
    const resumed = reconcileInkPackets({
      queue: paused.queue,
      pending: paused.pending,
      strokes: authoritative,
      inkRevision: 10,
      previousRevision: 10,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending).toEqual([]);
    expect(resumed.queue.operations).toEqual([]);
    expect(resumed.nextRevision).toBe(10);
    expect(takeInkPacket(resumed.queue, 2_000).operation).toBeUndefined();
    expect(previewInk(authoritative, resumed.pending)).toEqual([line(1)]);
  });

  it('keeps the same Undo when a held acknowledgement includes the accepted new gesture', () => {
    const { undo, paused } = heldUndo();
    const acceptedPicture = [line(1), line(2)];
    const acknowledged = reconcileInkPackets({
      queue: paused.queue,
      pending: paused.pending,
      strokes: acceptedPicture,
      inkRevision: 11,
      previousRevision: 10,
      paused: true,
      wasPaused: true,
    });
    expect(acknowledged.pending[0]!.revision).toBe(12);
    expect(acknowledged.pending[0]!.undoTarget).toBe(undo.undoTarget);
    expect(previewInk(acceptedPicture, acknowledged.pending)).toEqual([line(1)]);
    const resumed = reconcileInkPackets({
      queue: acknowledged.queue,
      pending: acknowledged.pending,
      strokes: acceptedPicture,
      inkRevision: 11,
      previousRevision: 11,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.nextRevision).toBe(12);
    expect(resumed.queue.operations).toHaveLength(1);
    expect(takeInkPacket(resumed.queue, 1_079).operation).toBeUndefined();
    const packet = takeInkPacket(resumed.queue, 1_080);
    expect(packet.operation?.revision).toBe(12);
    expect(packet.operation?.input).toEqual({ type: 'undo' });
    const state = { ...drawing(), strokes: acceptedPicture, inkRevision: 11 };
    const after = game.reduce(state, {
      type: 'input',
      now: state.began + 1,
      playerId: state.drawer,
      input: packet.operation!.input,
    });
    expect(after.strokes).toEqual([line(1)]);
    expect(after.inkRevision).toBe(12);
  });

  it('rebases later known strokes and their Undo contiguously after dropping a cancelled target', () => {
    const { authoritative, sent, undo } = heldUndo();
    const later = stroke(13, 3);
    const undoLater = pendingInkOperation(
      14,
      { type: 'undo' },
      previewInk(authoritative, [sent, undo, later]),
    );
    const resumed = reconcileInkPackets({
      queue: { operations: [undo, later, undoLater], sentAt: 1_000 },
      pending: [sent, undo, later, undoLater],
      strokes: authoritative,
      inkRevision: 10,
      previousRevision: 10,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending.map((operation) => operation.revision)).toEqual([11, 12]);
    expect(resumed.pending.map((operation) => operation.input)).toEqual([
      later.input,
      undoLater.input,
    ]);
    expect(resumed.pending[1]!.undoTarget).toEqual({ gesture: 3 });
    expect(resumed.nextRevision).toBe(12);
    expect(previewInk(authoritative, resumed.pending)).toEqual(authoritative);
    let state = { ...drawing(), strokes: authoritative, inkRevision: 10 };
    for (const operation of resumed.queue.operations) {
      state = game.reduce(state, {
        type: 'input',
        now: state.began + 1,
        playerId: state.drawer,
        input: operation.input,
      });
      expect(state.inkRevision).toBe(operation.revision);
    }
    expect(state.strokes).toEqual([line(1)]);
  });

  it('targets the picture after earlier queued Clear and ink rather than the authoritative last gesture', () => {
    const authoritative = [line(1)];
    const clear: PendingInk = { revision: 11, input: { type: 'clear' } };
    const later = stroke(12, 3);
    const undo = pendingInkOperation(
      13,
      { type: 'undo' },
      previewInk(authoritative, [clear, later]),
    );
    expect(undo.undoTarget).toEqual({ gesture: 3 });
    const resumed = reconcileInkPackets({
      queue: { operations: [clear, later, undo], sentAt: 1_000 },
      pending: [clear, later, undo],
      strokes: authoritative,
      inkRevision: 10,
      previousRevision: 10,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending.map((operation) => operation.input.type)).toEqual([
      'clear',
      'stroke',
      'undo',
    ]);
    expect(resumed.pending.map((operation) => operation.revision)).toEqual([11, 12, 13]);
    expect(previewInk(authoritative, resumed.pending)).toEqual([]);
  });

  it('keeps ordinary unpaused Undo and metadata-free legacy operations unchanged', () => {
    const picture = [line(1), line(2)];
    const targeted = pendingInkOperation(3, { type: 'undo' }, picture);
    expect(previewInk(picture, [targeted])).toEqual([line(1)]);
    const ordinary = reconcileInkPackets({
      queue: { operations: [targeted], sentAt: null },
      pending: [targeted],
      strokes: picture,
      inkRevision: 2,
      previousRevision: 2,
      paused: false,
      wasPaused: false,
    });
    expect(ordinary.pending[0]).toBe(targeted);
    expect(inputSchema.safeParse(targeted.input).success).toBe(true);
    const legacy: PendingInk = { revision: 3, input: { type: 'undo' } };
    const resumed = reconcileInkPackets({
      queue: { operations: [legacy], sentAt: null },
      pending: [legacy],
      strokes: picture,
      inkRevision: 2,
      previousRevision: 2,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending[0]!.input).toBe(legacy.input);
    expect(previewInk(picture, resumed.pending)).toEqual([line(1)]);
  });

  it('matches a legacy gesture by its canonical rounded stroke and protects another legacy stroke', () => {
    const legacy: Stroke = {
      color: 1,
      width: 4,
      points: [
        [10.4, 20.2],
        [30.1, 40.3],
      ],
    };
    const undo = pendingInkOperation(1, { type: 'undo' }, [legacy]);
    const accepted: Stroke = {
      ...legacy,
      points: [
        [10, 20],
        [30, 40],
      ],
    };
    expect(previewInk([accepted], [undo])).toEqual([]);
    const other: Stroke = {
      ...accepted,
      points: [
        [50, 20],
        [80, 40],
      ],
    };
    expect(previewInk([other], [undo])).toEqual([other]);
  });
});
