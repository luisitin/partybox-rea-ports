import { describe, expect, it } from 'vitest';
import { directionChanges, initialFeedback, observeMove, reserveMove } from './move-feedback';
import type { MoveSnapshot } from './move-feedback';

const board = [2, 2, ...Array<number>(14).fill(0)];
const view: MoveSnapshot = { key: 'play:1:p1', moves: 7, score: 32, active: true };

describe('authoritative move feedback and single in-flight direction', () => {
  it('serializes rapid directions against a delayed board and unlocks from its accepted counter', () => {
    const pending = reserveMove(initialFeedback(view), view, board, 'left', 1000)!;
    expect(pending.moves).toBe(7);
    expect(reserveMove(pending, view, board, 'down', 1001)).toBeNull();
    const delayed = observeMove(pending, view, 1200);
    expect(delayed.accepted).toBe(false);
    expect(delayed.state.pendingAt).toBe(1000);
    const next = { ...view, moves: 8, score: 36 };
    const receipt = observeMove(delayed.state, next, 1300);
    expect(receipt.accepted).toBe(true);
    expect(receipt.state.gain).toBe(4);
    expect(receipt.state.pendingAt).toBeNull();
    expect(reserveMove(receipt.state, next, board, 'down', 1449)).toBeNull();
    const ready = observeMove(receipt.state, next, 1450);
    expect(ready.state.readyAt).toBe(0);
    expect(ready.accepted).toBe(false);
    expect(reserveMove(ready.state, next, board, 'down', 1450)?.moves).toBe(8);
    expect(observeMove(ready.state, next, 1500).accepted).toBe(false);
  });

  it('never confirms a no-op or unacknowledged send and allows a bounded retry', () => {
    const corner = [2, ...Array<number>(15).fill(0)];
    expect(directionChanges(corner, 'left')).toBe(false);
    expect(directionChanges(corner, 'up')).toBe(false);
    expect(reserveMove(initialFeedback(view), view, corner, 'left', 1000)).toBeNull();
    const pending = reserveMove(initialFeedback(view), view, corner, 'right', 1000)!;
    const lost = observeMove(pending, view, 3000);
    expect(lost.accepted).toBe(false);
    expect(lost.state.gain).toBe(0);
    expect(lost.state.failed).toBe(true);
    expect(reserveMove(lost.state, view, corner, 'down', 3000)?.moves).toBe(7);
  });

  it('permits legal merges on full boards and rejects blocked directions', () => {
    const blocked = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    for (const dir of ['left', 'up', 'down', 'right'] as const)
      expect(directionChanges(blocked, dir)).toBe(false);
    for (const dir of ['left', 'right'] as const)
      expect(directionChanges([2, 2, ...blocked.slice(2)], dir)).toBe(true);
  });

  it('drops pending gestures on pause and resets historical gains on reload or new phase', () => {
    const pending = reserveMove(initialFeedback(view), view, board, 'left', 1000)!;
    const paused = { ...view, active: false };
    const held = observeMove(pending, paused, 1100);
    expect(held.accepted).toBe(false);
    expect(held.state.pendingAt).toBeNull();
    expect(reserveMove(held.state, paused, board, 'left', 2000)).toBeNull();
    expect(observeMove(held.state, view, 3000).accepted).toBe(false);
    const reload = { ...view, moves: 12, score: 256 };
    expect(observeMove(initialFeedback(reload), reload, 4000).accepted).toBe(false);
    const done = observeMove(pending, { ...reload, key: 'reveal:2:p1' }, 4000);
    expect(done.accepted).toBe(false);
    expect(done.state.gain).toBe(0);
    expect(done.state.pendingAt).toBeNull();
  });

  it('confirms accepted slides without inventing merge points and ignores duplicate snapshots', () => {
    const slid = { ...view, moves: 8 };
    const first = observeMove(initialFeedback(view), slid, 1000);
    expect(first.accepted).toBe(true);
    expect(first.state.gain).toBe(0);
    expect(observeMove(first.state, slid, 1050).accepted).toBe(false);
  });

  it('reserves a local cooldown after resume so an immediate direction cannot be rejected', () => {
    const accepted = { ...view, moves: 8, score: 36 };
    const receipt = observeMove(initialFeedback(view), accepted, 1000).state;
    const paused = observeMove(receipt, { ...accepted, active: false }, 1050).state;
    const resumed = observeMove(paused, accepted, 6000);
    expect(resumed.accepted).toBe(false);
    expect(resumed.state.gain).toBe(4);
    expect(reserveMove(resumed.state, accepted, board, 'left', 6149)).toBeNull();
    const ready = observeMove(resumed.state, accepted, 6150).state;
    expect(reserveMove(ready, accepted, board, 'left', 6150)?.pendingAt).toBe(6150);
    expect(ready.failed).toBe(false);
  });
});
