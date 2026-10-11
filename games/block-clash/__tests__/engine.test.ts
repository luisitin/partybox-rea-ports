import { describe, expect, it } from 'vitest';
import { applyInput, emptyGrid, lockPiece, settle } from '../server/engine';
import { spawn } from '../server/board';
import { MAX_RESETS } from '../server/types';
import { boardState, first, playing, withWell } from './helpers';

describe('locking and points', () => {
  it.each([
    [1, 100, 0],
    [2, 300, 1],
    [3, 500, 2],
    [4, 800, 4],
  ])('clears %i rows for %i points and %i attack', (rows, points, attack) => {
    const s = boardState({
      grid: withWell(rows, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      combo: -1,
      b2b: false,
    });
    const before = JSON.stringify(s);
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(JSON.stringify(s)).toBe(before);
    expect(first(next).lines).toBe(rows);
    expect(first(next).score).toBe(points);
    expect(first(next).attack).toBe(attack);
    expect(
      first(next).grid.every((row, y) => (y < 20 - (4 - rows) ? row.every((c) => c === 0) : true)),
    ).toBe(true);
    expect(first(next).sequence).toBe(first(s).sequence + 1);
  });

  it('awards two points per hard-drop cell and one per soft-drop cell', () => {
    const s = boardState({ active: { kind: 'O', x: 3, y: 0, rotation: 0 } });
    expect(first(applyInput(s, 'p1', { type: 'drop' }, s.began + 100)).score).toBe(36);
    expect(
      first(applyInput(s, 'p1', { type: 'move', direction: 'down' }, s.began + 100)).score,
    ).toBe(1);
  });

  it('adds the consecutive-clear combo without rewarding the first clear', () => {
    const s = boardState({
      grid: withWell(1, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      combo: 0,
    });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(first(next).combo).toBe(1);
    expect(first(next).score).toBe(150);
    const missed = lockPiece(
      boardState({ combo: 3, active: { kind: 'O', x: 3, y: 18, rotation: 0 } }),
      'p1',
      s.began + 100,
    );
    expect(first(missed).combo).toBe(-1);
  });

  it('back-to-back four-line clears earn the 1.5 multiplier and one extra attack', () => {
    const s = boardState({
      grid: withWell(4, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      combo: -1,
      b2b: true,
    });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(first(next).score).toBe(1200);
    expect(first(next).attack).toBe(5);
    expect(first(next).b2b).toBe(true);
  });

  it('recognizes a three-corner T-spin only when the last successful action was rotation', () => {
    const grid = withWell(1, [4]);
    grid[17]![3] = 8;
    grid[17]![5] = 8;
    const s = boardState({
      grid,
      active: { kind: 'T', x: 3, y: 17, rotation: 2 },
      lastRotate: true,
    });
    const spin = lockPiece(s, 'p1', s.began + 100);
    expect(first(spin).score).toBe(800);
    expect(first(spin).attack).toBe(2);
    const plain = lockPiece(boardState({ ...first(s), lastRotate: false }, s), 'p1', s.began + 100);
    expect(first(plain).score).toBe(100);
  });
});

describe('hold and opponents', () => {
  it('permits hold once per falling piece, and restores it after a lock', () => {
    let state = playing();
    const original = first(state).active!.kind;
    state = applyInput(state, 'p1', { type: 'hold' }, state.began + 100);
    expect(first(state).hold).toBe(original);
    expect(first(state).canHold).toBe(false);
    const again = applyInput(state, 'p1', { type: 'hold' }, state.began + 200);
    expect(first(again).hold).toBe(original);
    expect(first(again).sequence).toBe(first(state).sequence);
    state = applyInput(again, 'p1', { type: 'drop' }, state.began + 300);
    expect(first(state).canHold).toBe(true);
    const sequence = first(state).sequence;
    state = applyInput(state, 'p1', { type: 'hold' }, state.began + 400);
    expect(first(state).active!.kind).toBe(original);
    expect(first(state).sequence).toBe(sequence);
  });

  it('sends garbage to the chosen living rival and rejects self/unknown targets', () => {
    const s = boardState({
      grid: withWell(4, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      target: 'p3',
    });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(next.boards.find((b) => b.id === 'p3')!.pending).toBe(4);
    expect(next.boards.find((b) => b.id === 'p2')!.pending).toBe(0);
    for (const playerId of ['p1', 'ghost']) {
      expect(first(applyInput(s, 'p1', { type: 'target', playerId }, s.began + 100)).target).toBe(
        'p3',
      );
    }
  });

  it('cancels incoming rows before forwarding the remaining attack', () => {
    const s = boardState({
      grid: withWell(4, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      pending: 3,
      target: 'p2',
    });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(first(next).pending).toBe(0);
    expect(
      first(next)
        .grid.flat()
        .filter((c) => c === 8),
    ).toHaveLength(0);
    expect(next.boards.find((b) => b.id === 'p2')!.pending).toBe(1);
  });

  it('inserts one-hole garbage rows at lock and caps one insertion at eight rows', () => {
    const s = boardState({ pending: 12, active: { kind: 'O', x: 3, y: 18, rotation: 0 } });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(first(next).pending).toBe(4);
    for (const row of first(next).grid.slice(-8)) {
      expect(row.filter((c) => c === 0)).toHaveLength(1);
      expect(row.filter((c) => c === 8)).toHaveLength(9);
    }
  });

  it('caps the receiving queue at twenty rows', () => {
    let s = boardState({
      grid: withWell(4, [4]),
      active: { kind: 'I', x: 2, y: 16, rotation: 1 },
      target: 'p2',
    });
    s = { ...s, boards: s.boards.map((b) => (b.id === 'p2' ? { ...b, pending: 19 } : b)) };
    expect(lockPiece(s, 'p1', s.began + 100).boards.find((b) => b.id === 'p2')!.pending).toBe(20);
  });
});

describe('gravity and top-out', () => {
  it('gravity moves with elapsed time and settling at the same instant is idempotent', () => {
    const s = playing();
    const initialY = first(s).active!.y;
    const next = settle(s, s.began + 800);
    expect(first(next).active!.y).toBeGreaterThan(initialY);
    expect(settle(next, s.began + 800)).toEqual(next);
  });

  it('a delayed timer gives the same gravity and locks as partitioned timer delivery', () => {
    const s = playing(8, 91);
    const once = settle(s, s.began + 38_000);
    const partitioned = settle(
      settle(settle(s, s.began + 3500), s.began + 17_000),
      s.began + 38_000,
    );
    expect(partitioned).toEqual(once);
  });

  it('top-outs when garbage raises a nonempty top row', () => {
    const grid = emptyGrid();
    grid[0]![0] = 8;
    const s = boardState({ grid, pending: 1, active: { kind: 'O', x: 3, y: 18, rotation: 0 } });
    const next = lockPiece(s, 'p1', s.began + 100);
    expect(first(next).alive).toBe(false);
    expect(first(next).active).toBeNull();
    expect(first(next).diedAt).toBe(s.began + 100);
  });

  it('top-outs when a piece locks above the visible ceiling', () => {
    const s = boardState({ active: { kind: 'T', x: 3, y: -1, rotation: 0 } });
    expect(first(lockPiece(s, 'p1', s.began + 100)).alive).toBe(false);
  });

  it('top-outs when the spawn region is obstructed', () => {
    const grid = emptyGrid();
    grid[0] = [0, 8, 8, 8, 8, 8, 8, 8, 8, 0];
    const state = boardState({ grid });
    expect(spawn(state, first(state), state.began + 100).alive).toBe(false);
  });

  it('cannot postpone a grounded lock after the reset allowance is exhausted', () => {
    const s = boardState({
      active: { kind: 'O', x: 3, y: 18, rotation: 0 },
      lockAt: playing().began + 500,
      lockResets: MAX_RESETS,
    });
    const moved = applyInput(s, 'p1', { type: 'move', direction: 'left' }, s.began + 400);
    expect(first(moved).lockAt).toBe(first(s).lockAt);
    expect(first(settle(moved, s.began + 501)).sequence).toBe(first(s).sequence + 1);
  });
});
