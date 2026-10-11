// Delayed acknowledgements must never cap the race to one tap per network round trip.
import { describe, expect, it } from 'vitest';
import { predictPending, queueTap, reconcilePending } from './pending';
import type { PendingCursor, PendingSource } from './pending';

const source: PendingSource = {
  phase: 'play',
  began: 1000,
  row: 0,
  notes: [2, 0, 3, 1],
  player: true,
  alive: true,
  paused: false,
  connected: true,
  now: 1000,
};
const empty = (): PendingCursor => ({ key: '', taps: [] });
function playKnown(now: number, count = 4): PendingCursor {
  let pending = empty();
  for (let row = 0; row < count; row++) {
    pending = queueTap(
      pending,
      { ...source, now: now + row * 40 },
      source.notes[row]!,
      row,
    )!.pending;
  }
  return pending;
}

describe('disclosed-note input pipeline', () => {
  it.each([150, 250])('accepts four distinct row taps before an ACK delayed %i ms', (delay) => {
    const pending = playKnown(1000);
    const prediction = predictPending(pending, { ...source, now: 1000 + delay });
    expect(pending.taps.map((tap) => tap.row)).toEqual([0, 1, 2, 3]);
    expect(prediction.row).toBe(4);
    expect(prediction.unconfirmed).toBe(4);
    expect(prediction.notes).toEqual([null, null, null, null]);
    expect(prediction.enabled).toBe(false);
    expect(queueTap(pending, { ...source, now: 1000 + delay }, 0, 4)).toBeNull();
    const acknowledged = { ...source, row: 4, notes: [3, 2, 0, 2], now: 1000 + delay };
    const settled = reconcilePending(pending, acknowledged);
    expect(settled.taps).toHaveLength(0);
    expect(predictPending(settled, acknowledged).notes).toEqual([3, 2, 0, 2]);
    expect(queueTap(settled, acknowledged, 3, 4)?.input).toEqual({
      type: 'tap',
      column: 3,
      row: 4,
    });
  });

  it('drops only acknowledged taps when the server catches up partway', () => {
    const pending = playKnown(1000, 3);
    const partial = { ...source, row: 2, notes: [3, 1, 2, 0], now: 1250 };
    const settled = reconcilePending(pending, partial);
    expect(settled.taps.map((tap) => tap.row)).toEqual([2]);
    expect(predictPending(settled, partial)).toMatchObject({
      row: 3,
      notes: [1, 2, 0, null],
      unconfirmed: 1,
    });
    expect(queueTap(settled, partial, 1, 3)?.input.row).toBe(3);
  });

  it('blocks duplicate activations of the replaced row and preserves event order', () => {
    const first = queueTap(empty(), source, 2, 0)!;
    expect(queueTap(first.pending, source, 2, 0)).toBeNull();
    const second = queueTap(first.pending, source, 0, 1)!;
    expect(second.input.row).toBe(1);
    expect(queueTap(second.pending, source, 2, 0)).toBeNull();
    expect(queueTap(second.pending, source, 3, 3)).toBeNull();
  });

  it('predicts a wrong lane as out and waits for authoritative run state', () => {
    const wrong = queueTap(empty(), source, 1, 0)!;
    expect(wrong.wrong).toBe(true);
    expect(predictPending(wrong.pending, source)).toMatchObject({
      out: true,
      enabled: false,
      unconfirmed: 0,
    });
    expect(queueTap(wrong.pending, source, 2, 0)).toBeNull();
    const confirmed = { ...source, alive: false, notes: [], now: 1100 };
    expect(reconcilePending(wrong.pending, confirmed).taps).toHaveLength(0);
    expect(predictPending(wrong.pending, confirmed).enabled).toBe(false);
  });

  it('clears an unacknowledged send on disconnect and can retry the absolute row on reconnect', () => {
    const first = queueTap(empty(), source, 2, 0)!;
    const disconnected = { ...source, connected: false, now: 1200 };
    const cleared = reconcilePending(first.pending, disconnected);
    expect(cleared.taps).toHaveLength(0);
    expect(queueTap(cleared, disconnected, 2, 0)).toBeNull();
    const reconnected = { ...source, now: 1300 };
    expect(queueTap(cleared, reconnected, 2, 0)?.input).toEqual(first.input);
  });

  it('releases a lost send without a disconnect flag, using the existing held clock', () => {
    const first = queueTap(empty(), source, 2, 0)!;
    expect(predictPending(first.pending, { ...source, now: 1749 }).row).toBe(1);
    const retry = { ...source, now: 1750 };
    expect(reconcilePending(first.pending, retry).taps).toHaveLength(0);
    expect(queueTap(first.pending, retry, 2, 0)?.input).toEqual(first.input);
  });

  it('clears on pause, shifted resume clock and phase change, never enabling a spectator', () => {
    const pending = playKnown(1000, 2);
    for (const changed of [
      { ...source, paused: true },
      { ...source, began: 1500 },
      { ...source, phase: 'score' },
      { ...source, player: false },
    ])
      expect(reconcilePending(pending, changed).taps).toHaveLength(0);
    expect(queueTap(empty(), { ...source, player: false }, 2, 0)).toBeNull();
    expect(queueTap(empty(), { ...source, paused: true }, 2, 0)).toBeNull();
  });
});
