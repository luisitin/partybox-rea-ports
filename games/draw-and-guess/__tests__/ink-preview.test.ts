import { describe, expect, it } from 'vitest';
import { nextGesture, previewInk } from '../client/ink';
import type { PendingInk } from '../client/ink';
import type { Stroke } from '../server/types';
import { game } from '../server/index';
import { deepFreeze, drawing, kit } from './helpers';

const line = (gesture: number, x: number, color = 2): Stroke => ({
  gesture,
  color,
  width: 9,
  points: [
    [x, 100],
    [x + 10, 100],
  ],
});

describe('unacknowledged canvas operations', () => {
  it('replays a second chunk even when the authoritative history still has one gesture', () => {
    const server = deepFreeze([line(1, 10)]);
    const pending = deepFreeze<PendingInk[]>([
      { revision: 2, input: { type: 'stroke', stroke: line(1, 20) } },
    ]);
    expect(previewInk(server, pending)).toEqual([
      {
        ...line(1, 10),
        points: [
          [10, 100],
          [20, 100],
          [30, 100],
        ],
      },
    ]);
    expect(server[0]!.points).toHaveLength(2);
  });

  it('replays clear and new ink in order without reviving a pending old gesture', () => {
    const server = [line(1, 10)];
    const pending: PendingInk[] = [
      { revision: 2, input: { type: 'stroke', stroke: line(1, 20) } },
      { revision: 3, input: { type: 'clear' } },
      { revision: 4, input: { type: 'stroke', stroke: line(2, 100) } },
    ];
    expect(previewInk(server, pending)).toEqual([line(2, 100)]);
  });

  it('optimistic Undo matches one whole gesture, including its different color fragments', () => {
    const server = [line(1, 10), line(2, 100), line(2, 110, 3)];
    expect(previewInk(server, [{ revision: 4, input: { type: 'undo' } }])).toEqual([line(1, 10)]);
  });

  it('allocates gestures above both the server and unacknowledged queue after a refresh', () => {
    const pending: PendingInk[] = [
      { revision: 4, input: { type: 'stroke', stroke: line(20, 100) } },
    ];
    expect(nextGesture([line(10, 10)], pending, 15)).toBe(21);
    expect(nextGesture([], [], 42)).toBe(43);
  });

  it('refreshes after the maximum legal gesture without rejecting or merging the next stroke', () => {
    const start = drawing();
    const maximum = kit.input(
      start,
      start.drawer,
      { type: 'stroke', stroke: line(1_000_000_000, 10) },
      start.began + 1000,
    );
    const gesture = nextGesture(maximum.strokes, [], 0);
    const input = { type: 'stroke' as const, stroke: line(gesture, 100) };
    expect(game.inputSchema.safeParse(input).success).toBe(true);
    expect(maximum.strokes.some((stroke) => stroke.gesture === gesture)).toBe(false);
    const next = kit.input(maximum, start.drawer, input, start.began + 1100);
    expect(next.strokes).toHaveLength(2);
    expect(next.inkRevision).toBe(maximum.inkRevision + 1);
  });

  it('skips stored and pending IDs at wrap, then allocates another distinct legal gesture', () => {
    const stored = [line(1_000_000_000, 10), line(0, 20)];
    const pending: PendingInk[] = [
      { revision: 3, input: { type: 'stroke', stroke: line(1, 100) } },
    ];
    const first = nextGesture(stored, pending, 1_000_000_000);
    expect(first).toBe(2);
    pending.push({ revision: 4, input: { type: 'stroke', stroke: line(first, 110) } });
    const second = nextGesture(stored, pending, first);
    expect(second).toBe(3);
    for (const gesture of [first, second]) {
      expect(
        game.inputSchema.safeParse({ type: 'stroke', stroke: line(gesture, 200) }).success,
      ).toBe(true);
    }
  });
});
