import { describe, expect, it } from 'vitest';
import { MAX_GUESSES, MAX_POINTS, MAX_STROKES, inputSchema } from '../server/types';
import type { Input } from '../server/types';
import { chunk, drawing, guesserIds, kit } from './helpers';

describe('bounded phone input schema', () => {
  it('accepts the supported palette, sizes, coordinate boundaries and maximum chunk', () => {
    for (const color of [0, 1, 2, 3, 4, 5])
      for (const size of [2, 5, 9])
        expect(
          inputSchema.safeParse({
            type: 'stroke',
            stroke: {
              id: 0,
              seq: 0,
              color,
              size,
              points: [
                [0, 0],
                [1000, 600],
              ],
            },
          }).success,
        ).toBe(true);
    expect(inputSchema.safeParse(chunk(0, 0, 32)).success).toBe(true);
    expect(inputSchema.safeParse({ type: 'guess', text: 'a'.repeat(60) }).success).toBe(true);
    for (const index of [0, 1, 2])
      expect(inputSchema.safeParse({ type: 'choose', index }).success).toBe(true);
  });

  it('rejects oversized, empty, fractional, out-of-range, and non-finite strokes and guesses', () => {
    const valid = chunk();
    if (valid.type !== 'stroke') throw new Error('stroke helper');
    for (const replacement of [
      { points: [] },
      { points: Array.from({ length: 33 }, () => [0, 0]) },
      { points: [[-1, 0]] },
      { points: [[1001, 0]] },
      { points: [[0, 601]] },
      { points: [[0.5, 0]] },
      { points: [[Number.NaN, 0]] },
      { points: [[Number.POSITIVE_INFINITY, 0]] },
      { seq: -1 },
      { seq: 0.5 },
      { id: -1 },
      { id: 0.5 },
      { color: 6 },
      { size: 3 },
    ])
      expect(
        inputSchema.safeParse({ type: 'stroke', stroke: { ...valid.stroke, ...replacement } })
          .success,
      ).toBe(false);
    for (const text of ['', 'a'.repeat(61)])
      expect(inputSchema.safeParse({ type: 'guess', text }).success).toBe(false);
    for (const index of [-1, 3, 0.5])
      expect(inputSchema.safeParse({ type: 'choose', index }).success).toBe(false);
  });
});

describe('drawing replication and replay protection', () => {
  it('only the artist can draw and broadcasts accepted chunks identically', () => {
    const start = drawing();
    for (const id of [...guesserIds(start), 'spectator', '__proto__'])
      expect(kit.input(start, id, chunk(), start.began + 1000)).toBe(start);
    const drawn = kit.input(start, start.drawerId, chunk(), start.began + 1000);
    expect(drawn.strokes).toHaveLength(1);
    expect(kit.tv(drawn).strokes).toEqual(drawn.strokes);
    for (const id of [...Object.keys(drawn.players), 'spectator'])
      expect(kit.cv(drawn, id).strokes).toEqual(drawn.strokes);
    expect(kit.cv(drawn, drawn.drawerId).nextSeq).toBe(1);
  });

  it('ignores duplicate/out-of-order packets and packets from an older gesture', () => {
    let state = drawing();
    state = kit.input(state, state.drawerId, chunk(3, 2), state.began + 1000);
    for (const input of [chunk(3, 2), chunk(2, 2), chunk(4, 1)])
      expect(kit.input(state, state.drawerId, input, state.began + 2000)).toBe(state);
    const next = kit.input(state, state.drawerId, chunk(4, 2), state.began + 2000);
    expect(next.strokes).toHaveLength(2);
    expect(next.lastSeq).toBe(4);
    expect(next.lastStroke).toBe(2);
  });

  it('undo removes every chunk of the latest gesture and clear never resets replay protection', () => {
    let state = drawing();
    state = kit.input(state, state.drawerId, chunk(0, 0), state.began + 1000);
    state = kit.input(state, state.drawerId, chunk(1, 0), state.began + 1100);
    state = kit.input(state, state.drawerId, chunk(2, 1), state.began + 1200);
    state = kit.input(state, state.drawerId, chunk(3, 1), state.began + 1300);
    const first = kit.input(state, state.drawerId, { type: 'undo' }, state.began + 1400);
    expect(first.strokes.map((stroke) => stroke.id)).toEqual([0, 0]);
    expect(first.lastSeq).toBe(3);
    const second = kit.input(first, first.drawerId, { type: 'undo' }, first.began + 1500);
    expect(second.strokes).toEqual([]);
    expect(kit.input(second, second.drawerId, chunk(2, 1), second.began + 1600)).toBe(second);
    const renewed = kit.input(second, second.drawerId, chunk(4, 2), second.began + 1700);
    const cleared = kit.input(renewed, renewed.drawerId, { type: 'clear' }, renewed.began + 1800);
    expect(cleared.strokes).toEqual([]);
    expect(cleared.lastSeq).toBe(4);
    expect(kit.input(cleared, cleared.drawerId, chunk(4, 2), cleared.began + 1900)).toBe(cleared);
    for (const id of guesserIds(renewed)) {
      expect(kit.input(renewed, id, { type: 'undo' })).toBe(renewed);
      expect(kit.input(renewed, id, { type: 'clear' })).toBe(renewed);
    }
  });

  it('caps a canvas at 2048 points without losing its accepted drawing', () => {
    let state = drawing();
    for (let seq = 0; seq < MAX_POINTS / 32; seq++)
      state = kit.input(state, state.drawerId, chunk(seq, seq, 32), state.began + 1000 + seq);
    expect(MAX_POINTS).toBe(2048);
    expect(state.strokes.reduce((count, stroke) => count + stroke.points.length, 0)).toBe(
      MAX_POINTS,
    );
    expect(
      kit.input(
        state,
        state.drawerId,
        chunk(state.lastSeq + 1, state.lastStroke + 1, 1),
        state.began + 2000,
      ),
    ).toBe(state);
    expect(Buffer.byteLength(JSON.stringify(state))).toBeLessThan(256 * 1024);
    expect(Buffer.byteLength(JSON.stringify(kit.tv(state)))).toBeLessThan(64 * 1024);
  });

  it('independently caps at 256 chunks, even if their combined points stay below the point cap', () => {
    let state = drawing();
    for (let seq = 0; seq < MAX_STROKES; seq++)
      state = kit.input(state, state.drawerId, chunk(seq, seq, 1), state.began + 1000 + seq);
    expect(MAX_STROKES).toBe(256);
    expect(state.strokes).toHaveLength(256);
    expect(kit.input(state, state.drawerId, chunk(256, 256, 1), state.began + 2000)).toBe(state);
  });

  it('bounds private guess history and discards empty and repeated guesses', () => {
    let state = drawing();
    const id = guesserIds(state)[0]!;
    expect(kit.input(state, id, { type: 'guess', text: '   ' })).toBe(state);
    for (let index = 0; index < MAX_GUESSES; index++)
      state = kit.input(
        state,
        id,
        { type: 'guess', text: `incorrect ${index}` },
        state.began + 1000 + index,
      );
    expect(state.guesses[id]).toHaveLength(MAX_GUESSES);
    const limited = kit.input(
      state,
      id,
      { type: 'guess', text: 'another incorrect guess' },
      state.began + 2000,
    );
    expect(limited.guesses[id]).toHaveLength(MAX_GUESSES);
    expect(limited.feedback[id]).toBe('limited');
    expect(
      kit.input(
        limited,
        id,
        { type: 'guess', text: 'another incorrect guess' },
        state.began + 2100,
      ),
    ).toBe(limited);
    const fresh = drawing();
    const once = kit.input(fresh, id, { type: 'guess', text: 'wrong' }, fresh.began + 1000);
    expect(kit.input(once, id, { type: 'guess', text: ' WRONG ' }, fresh.began + 2000)).toBe(once);
  });

  it('rejects drawing controls in other phases', () => {
    for (const state of [kit.start(), kit.finish(drawing()), kit.vip(drawing(), 'end')])
      for (const input of [chunk(), { type: 'undo' }, { type: 'clear' }] as Input[])
        expect(kit.input(state, state.drawerId, input)).toBe(state);
  });
});
