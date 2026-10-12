import { describe, expect, it } from 'vitest';
import type { Stroke } from '../server/types';
import { pendingInkOperation, previewInk } from './ink';
import type { PendingInk } from './ink';
import {
  INK_DRAFT_MAX_CHARS,
  INK_DRAFT_MAX_OPERATIONS,
  DEFAULT_INK_BRUSH,
  restoreInkDraft,
  saveInkDraft,
} from './inkDraft';
import { activeInkTail, reconcileInkPackets, takeInkPacket } from './inkPackets';

const line = (gesture: number): Stroke => ({
  gesture,
  color: 0,
  width: 9,
  points: [
    [gesture * 10, 20],
    [gesture * 10 + 1, 30],
  ],
});

describe('same-turn selected brush refresh', () => {
  const grayThick = { color: 5, width: 18 as const };
  const emptyQueue = { operations: [], sentAt: 1_000 };

  it('retains a brush-only selection without inventing pending or sent ink', () => {
    const saved = saveInkDraft(emptyQueue, undefined, 10, grayThick);
    expect(saved).not.toBe('');
    const restored = restoreInkDraft(saved, [line(1)], 10, 2_000);
    expect(restored.brush).toEqual(grayThick);
    expect(restored.pending).toEqual([]);
    expect(restored.queue.operations).toEqual([]);
    expect(restored.nextRevision).toBe(10);
    expect(takeInkPacket(restored.queue, 2_080).operation).toBeUndefined();
  });

  it('keeps hydrated selections through the immediate save and removal-before-send', () => {
    const queued = [draw(11, 2)];
    const saved = saveInkDraft({ ...emptyQueue, operations: queued }, undefined, 10, grayThick);
    const restored = restoreInkDraft(saved, [line(1)], 10, 2_000);
    const reSaved = saveInkDraft(restored.queue, undefined, 10, restored.brush);
    expect(restoreInkDraft(reSaved, [line(1)], 10, 2_000).brush).toEqual(grayThick);
    const packet = takeInkPacket(restored.queue, 2_080);
    const beforeSend = saveInkDraft(packet.queue, undefined, 10, restored.brush);
    const nextMount = restoreInkDraft(beforeSend, [line(1), line(2)], 11, 3_000);
    expect(nextMount.brush).toEqual(grayThick);
    expect(nextMount.pending).toEqual([]);
    // Existing queued ink retains its own style; the restored selection governs only new ink.
    expect(packet.operation?.input).toEqual(queued[0]!.input);
  });

  it('supports old snapshots and old helper calls with Ink/Medium defaults', () => {
    expect(saveInkDraft(emptyQueue, undefined, 10)).toBe('');
    const legacySaved = save([draw(11, 2)]);
    expect(JSON.parse(legacySaved)).not.toHaveProperty('brush');
    expect(restoreInkDraft(legacySaved, [line(1)], 10, 2_000).brush).toEqual(DEFAULT_INK_BRUSH);
    expect(restoreInkDraft('', [], 0, 2_000).brush).toEqual(DEFAULT_INK_BRUSH);
  });

  it('rejects invalid brush fields and discards brush-only snapshots after a backward reset', () => {
    const valid = JSON.parse(saveInkDraft(emptyQueue, undefined, 10, grayThick));
    for (const brush of [
      { color: -1, width: 9 },
      { color: 6, width: 9 },
      { color: 1.5, width: 9 },
      { color: 5, width: 1 },
      { color: 5 },
      { color: 5, width: 18, extra: true },
      null,
    ]) {
      const restored = restoreInkDraft(JSON.stringify({ ...valid, brush }), [], 10, 2_000);
      expect(restored.brush).toEqual(DEFAULT_INK_BRUSH);
      expect(restored.pending).toEqual([]);
    }
    expect(restoreInkDraft(JSON.stringify(valid), [], 9, 2_000).brush).toEqual(DEFAULT_INK_BRUSH);
    expect(restoreInkDraft(JSON.stringify(valid), [], 11, 2_000).brush).toEqual(grayThick);
  });
});
const draw = (revision: number, gesture: number): PendingInk => ({
  revision,
  input: { type: 'stroke', stroke: line(gesture) },
});
const save = (operations: PendingInk[], tail?: Stroke, revision = 10): string =>
  saveInkDraft({ operations, sentAt: 1_000 }, tail, revision);

describe('artist never-sent refresh snapshot', () => {
  it('restores queued dots and one dirty tail, rebased above the latest authoritative revision', () => {
    const first = draw(11, 2);
    const tail = activeInkTail({ ...line(3), id: 2, dirty: true });
    const saved = save([first], tail);
    const restored = restoreInkDraft(saved, [line(1)], 15, 2_000);
    expect(restored.pending.map((value) => value.revision)).toEqual([16, 17]);
    expect(restored.pending.map((value) => value.input)).toEqual([
      first.input,
      { type: 'stroke', stroke: line(3) },
    ]);
    expect(restored.queue.operations).toBe(restored.pending);
    expect(previewInk([line(1)], restored.pending)).toEqual([line(1), line(2), line(3)]);
    expect(restored.nextRevision).toBe(17);
    expect(takeInkPacket(restored.queue, 2_079).operation).toBeUndefined();
    expect(takeInkPacket(restored.queue, 2_080).operation?.revision).toBe(16);
  });

  it('records no already-sent pending ink, and removes a packet before transport can send it', () => {
    const queued = [draw(11, 2), draw(12, 3)];
    const packet = takeInkPacket({ operations: queued, sentAt: null }, 1_000);
    const savedBeforeSend = saveInkDraft(packet.queue, undefined, 10);
    const restored = restoreInkDraft(savedBeforeSend, [line(1), line(2)], 11, 2_000);
    expect(restored.pending).toEqual([draw(12, 3)]);
    expect(previewInk([line(1), line(2)], restored.pending)).toEqual([line(1), line(2), line(3)]);
    const last = takeInkPacket(packet.queue, 1_080);
    expect(saveInkDraft(last.queue, undefined, 10)).toBe('');
  });

  it('stores a flushed tail only once and never turns its unchanged endpoint into a new stroke', () => {
    const active = { ...line(2), id: 5, dirty: true };
    const tail = activeInkTail(active)!;
    const queued = [{ revision: 11, input: { type: 'stroke' as const, stroke: tail } }];
    active.dirty = false;
    active.points = active.points.slice(-1);
    const saved = save(queued, activeInkTail(active));
    expect(restoreInkDraft(saved, [line(1)], 10, 2_000).pending).toEqual(queued);
  });

  it('prunes a missing Undo target without removing a later queued gesture or its Undo', () => {
    const targetMissing = pendingInkOperation(12, { type: 'undo' }, [line(1), line(2)]);
    const later = draw(13, 3);
    const undoLater = pendingInkOperation(14, { type: 'undo' }, [line(1), line(3)]);
    const restored = restoreInkDraft(save([targetMissing, later, undoLater]), [line(1)], 10, 0);
    expect(restored.pending.map((value) => value.input.type)).toEqual(['stroke', 'undo']);
    expect(restored.pending.map((value) => value.revision)).toEqual([11, 12]);
    expect(restored.pending[1]?.undoTarget).toEqual({ gesture: 3 });
    expect(previewInk([line(1)], restored.pending)).toEqual([line(1)]);
  });

  it('keeps accepted late-ack targets through paused hydration and prunes only at authoritative resume', () => {
    const undo = pendingInkOperation(12, { type: 'undo' }, [line(1), line(2)]);
    const restored = restoreInkDraft(save([undo]), [line(1)], 10, 1_000, true);
    expect(restored.pending[0]?.undoTarget).toEqual({ gesture: 2 });
    const resumed = reconcileInkPackets({
      queue: restored.queue,
      pending: restored.pending,
      strokes: [line(1), line(2)],
      inkRevision: 11,
      previousRevision: 10,
      paused: false,
      wasPaused: true,
    });
    expect(resumed.pending[0]?.revision).toBe(12);
    expect(previewInk([line(1), line(2)], resumed.pending)).toEqual([line(1)]);
    const rejected = reconcileInkPackets({
      queue: restored.queue,
      pending: restored.pending,
      strokes: [line(1)],
      inkRevision: 10,
      previousRevision: 10,
      paused: false,
      wasPaused: true,
    });
    expect(rejected.pending).toEqual([]);
  });

  it('resolves Clear and queued-stroke targets in FIFO order after refresh', () => {
    const clear: PendingInk = { revision: 11, input: { type: 'clear' } };
    const stroke = draw(12, 3);
    const undo = pendingInkOperation(13, { type: 'undo' }, [line(3)]);
    const restored = restoreInkDraft(save([clear, stroke, undo]), [line(1)], 18, 0);
    expect(restored.pending.map((value) => value.revision)).toEqual([19, 20, 21]);
    expect(previewInk([line(1)], restored.pending)).toEqual([]);
  });

  it('preserves rounded legacy stroke targets and metadata-free legacy Undo behavior', () => {
    const legacy: Stroke = {
      color: 1,
      width: 4,
      points: [
        [10.2, 20.3],
        [30.4, 40.4],
      ],
    };
    const targeted = pendingInkOperation(11, { type: 'undo' }, [legacy]);
    const restored = restoreInkDraft(save([targeted]), [legacy], 10, 0);
    expect(previewInk([legacy], restored.pending)).toEqual([]);
    const mismatch = restoreInkDraft(save([targeted]), [{ ...legacy, color: 2 }], 10, 0);
    expect(mismatch.pending).toEqual([]);
    const old: PendingInk = { revision: 11, input: { type: 'undo' } };
    expect(previewInk([legacy], restoreInkDraft(save([old]), [legacy], 10, 0).pending)).toEqual([]);
  });

  it('rejects backward resets, corrupt JSON, unknown fields, non-ink input and invalid metadata', () => {
    const valid = save([draw(11, 2)]);
    expect(restoreInkDraft(valid, [], 9, 0).pending).toEqual([]);
    const parsed = JSON.parse(valid);
    const invalid = [
      '{',
      '',
      'x'.repeat(INK_DRAFT_MAX_CHARS + 1),
      JSON.stringify({ ...parsed, version: 2 }),
      JSON.stringify({ ...parsed, extra: true }),
      JSON.stringify({ ...parsed, inkRevision: -1 }),
      JSON.stringify({ ...parsed, operations: [{ input: { type: 'guess', text: 'private' } }] }),
      JSON.stringify({
        ...parsed,
        operations: [{ input: { type: 'undo' }, undoTarget: { gesture: -1 } }],
      }),
      JSON.stringify({
        ...parsed,
        operations: [{ input: { type: 'clear' }, undoTarget: { empty: true } }],
      }),
      JSON.stringify({
        ...parsed,
        operations: [{ input: { type: 'stroke', stroke: { ...line(2), points: [[NaN, 0]] } } }],
      }),
    ];
    for (const saved of invalid) expect(restoreInkDraft(saved, [], 10, 0).pending).toEqual([]);
  });

  it('caps snapshots rather than retaining an unbounded synthetic queue', () => {
    const operations = Array.from({ length: INK_DRAFT_MAX_OPERATIONS + 1 }, (_, i) =>
      draw(i + 11, i),
    );
    expect(save(operations)).toBe('');
    expect(save(operations.slice(0, INK_DRAFT_MAX_OPERATIONS), line(2))).toBe('');
    const bounded: PendingInk[] = Array.from({ length: INK_DRAFT_MAX_OPERATIONS }, (_, i) => ({
      revision: i + 11,
      input: { type: 'clear' },
    }));
    expect(restoreInkDraft(save(bounded), [], 10, 0).pending).toHaveLength(
      INK_DRAFT_MAX_OPERATIONS,
    );
    const dense = line(2);
    dense.points = Array.from({ length: 25 }, (_, i): [number, number] => [i, i]);
    expect(save([], dense)).toBe('');
    expect(restoreInkDraft(save([draw(11, 2)]), [], Number.MAX_SAFE_INTEGER, 0).pending).toEqual(
      [],
    );
  });
});
