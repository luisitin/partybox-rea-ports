import { describe, expect, it } from 'vitest';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, Point, State, Stroke } from '../server/types';
import { drawing, guesser, jsonBytes, kit, stroke } from './helpers';

function chunk(points: Point[], gesture: number, color = 2, width: 4 | 9 | 18 = 9): Stroke {
  return { points, gesture, color, width };
}

const path = (s: State): Point[] =>
  s.strokes
    .flatMap((line) => line.points)
    .filter(
      (point, i, all) => i === 0 || point[0] !== all[i - 1]![0] || point[1] !== all[i - 1]![1],
    );

describe('streamed finger gestures', () => {
  it('accepts legacy strokes and optional bounded integer gesture ids', () => {
    expect(game.inputSchema.safeParse({ type: 'stroke', stroke }).success).toBe(true);
    for (const gesture of [0, 42, 1_000_000_000]) {
      expect(
        game.inputSchema.safeParse({ type: 'stroke', stroke: { ...stroke, gesture } }).success,
      ).toBe(true);
    }
    for (const gesture of [-1, 0.5, 1_000_000_001, NaN, Infinity, null, '42']) {
      expect(
        game.inputSchema.safeParse({ type: 'stroke', stroke: { ...stroke, gesture } }).success,
      ).toBe(false);
    }
  });

  it('merges contiguous chunks of one gesture, preserves their path and undoes the gesture once', () => {
    let s = drawing();
    s = kit.input(
      s,
      s.drawer,
      {
        type: 'stroke',
        stroke: chunk(
          [
            [10, 10],
            [20, 20],
          ],
          1,
        ),
      },
      s.began + 100,
    );
    const firstGesture = s.strokes;
    for (let i = 0; i < 3; i++) {
      s = kit.input(
        s,
        s.drawer,
        {
          type: 'stroke',
          stroke: chunk(
            [
              [30 + i * 10, 30],
              [40 + i * 10, 30],
            ],
            2,
          ),
        },
        s.began + 200 + i * 100,
      );
    }
    expect(s.strokes).toHaveLength(2);
    expect(path(s)).toEqual([
      [10, 10],
      [20, 20],
      [30, 30],
      [40, 30],
      [50, 30],
      [60, 30],
    ]);
    expect(s.inkRevision).toBe(4);
    const undone = kit.input(s, s.drawer, { type: 'undo' }, s.began + 600);
    expect(undone.strokes).toEqual(firstGesture);
    expect(undone.inkRevision).toBe(5);
  });

  it('does not merge across color, thickness, other gestures or legacy packets', () => {
    let s = drawing();
    const strokes = [
      chunk([[10, 10]], 7, 2, 9),
      chunk([[20, 20]], 7, 3, 9),
      chunk([[30, 30]], 7, 3, 18),
      chunk([[40, 40]], 8, 3, 18),
      chunk([[50, 50]], 7, 3, 18),
      stroke,
      stroke,
    ];
    for (const [i, line] of strokes.entries()) {
      s = kit.input(s, s.drawer, { type: 'stroke', stroke: line }, s.began + 100 + i * 100);
    }
    expect(s.strokes).toEqual(strokes);
    expect(kit.input(s, s.drawer, { type: 'undo' }, s.began + 1000).strokes).toEqual(
      strokes.slice(0, -1),
    );
  });

  it('undo removes all contiguous style fragments belonging to the latest gesture', () => {
    let s = drawing();
    s = kit.input(s, s.drawer, { type: 'stroke', stroke: chunk([[10, 10]], 1) }, s.began + 100);
    const before = s.strokes;
    for (const [i, line] of [
      chunk([[20, 20]], 2, 2, 9),
      chunk([[30, 30]], 2, 3, 9),
      chunk([[40, 40]], 2, 3, 18),
    ].entries()) {
      s = kit.input(s, s.drawer, { type: 'stroke', stroke: line }, s.began + 200 + i * 100);
    }
    expect(s.strokes).toHaveLength(4);
    expect(kit.input(s, s.drawer, { type: 'undo' }, s.began + 600).strokes).toEqual(before);
  });

  it('750 chunks keep drawing for an entire minute without exhausting the canvas or wire budget', () => {
    let s = kit.start({ settings: { drawSeconds: 60 } });
    s = kit.input(s, s.drawer, { type: 'choose', index: 0 });
    const began = s.began;
    let last: Point = [0, 0];
    for (let i = 0; i < 750; i++) {
      const now = began + 1 + Math.floor((i * 59_998) / 749);
      while (s.phase.deadline !== null && s.phase.deadline <= now) s = kit.timer(s);
      const points = Array.from({ length: 24 }, (_, j): Point => [
        (i * 23 + j) % 1001,
        Math.floor((i * 23 + j) / 1001) % 601,
      ]);
      last = points.at(-1)!;
      s = kit.input(s, s.drawer, { type: 'stroke', stroke: chunk(points, 99) }, now);
      expect(s.phase.id).toBe('draw');
      expect(s.strokes).toHaveLength(1);
      expect(s.strokes.reduce((n, line) => n + line.points.length, 0)).toBeLessThanOrEqual(3500);
    }
    expect(s.inkRevision).toBe(750);
    expect(s.strokes[0]!.points.at(-1)).toEqual(last);
    expect(jsonBytes(s)).toBeLessThan(256 * 1024);
    expect(jsonBytes(game.tvView(s))).toBeLessThan(64 * 1024);
    for (const id of [...Object.keys(s.players), 'spectator', '__proto__']) {
      expect(jsonBytes(game.controllerView(s, id))).toBeLessThan(64 * 1024);
    }
    expect(kit.input(s, s.drawer, { type: 'undo' }, began + 59_999).strokes).toEqual([]);
  });

  it('clear resets the drawing and a reused gesture starts a new path', () => {
    let s = drawing();
    s = kit.input(s, s.drawer, { type: 'stroke', stroke: chunk([[10, 10]], 1) }, s.began + 100);
    s = kit.input(s, s.drawer, { type: 'clear' }, s.began + 200);
    s = kit.input(s, s.drawer, { type: 'stroke', stroke: chunk([[40, 40]], 1) }, s.began + 300);
    expect(s.strokes).toEqual([chunk([[40, 40]], 1)]);
    expect(s.inkRevision).toBe(3);
  });
});

describe('drawing acknowledgements and solver receipts', () => {
  it('keeps solved players in the progress denominator through a disconnect and return', () => {
    let s = drawing();
    const ids = s.order.filter((id) => id !== s.drawer);
    const first = ids[0]!;
    const second = ids[1]!;
    s = kit.input(s, first, { type: 'guess', text: s.word }, s.began + 1000);
    s = kit.input(s, second, { type: 'guess', text: s.word }, s.began + 2000);
    expect(s.phase.id).toBe('draw');
    s = kit.player(s, first, false, undefined, s.began + 3000);
    expect(s.phase.id).toBe('draw');
    for (const view of [
      game.tvView(s),
      game.controllerView(s, s.drawer),
      game.controllerView(s, 'spectator'),
    ]) {
      expect(view.solvedCount).toBe(2);
      expect(view.guesserCount).toBe(3);
    }
    expect(game.controllerView(s, first).myPoints).toBe(s.solved[first]);
    s = kit.player(s, first, true, undefined, s.began + 4000);
    expect(game.controllerView(s, s.drawer).guesserCount).toBe(3);
    expect(game.controllerView(s, s.drawer).solvedCount).toBe(2);
  });

  it('the only solver in a two-player party keeps their receipt through immediate reveal and the final turn', () => {
    let s = kit.start({ players: testPlayers(2) });
    for (let turn = 0; turn < 2; turn++) {
      s = kit.input(s, s.drawer, { type: 'choose', index: 0 });
      const id = guesser(s);
      s = kit.input(s, id, { type: 'guess', text: s.word }, s.began + 6000);
      expect(s.phase.id).toBe('reveal');
      expect(s.solved[id]).toBe(860);
      expect(game.controllerView(s, id).myPoints).toBe(860);
      expect(game.controllerView(s, id).canGuess).toBe(false);
      const finished = kit.timer(s);
      if (turn === 1) {
        expect(finished.phase.id).toBe('done');
        expect(game.controllerView(finished, id).myPoints).toBe(860);
      } else expect(finished.phase.id).toBe('choose');
      s = finished;
    }
  });

  it('starts revision at zero, acknowledges every accepted edit including empty edits, and resets on the next turn', () => {
    let s = drawing();
    expect(s.inkRevision).toBe(0);
    for (const [i, input] of [
      { type: 'undo' },
      { type: 'clear' },
      { type: 'stroke', stroke },
      { type: 'clear' },
    ].entries()) {
      s = kit.input(s, s.drawer, input as Input, s.began + 100 + i * 100);
      expect(s.inkRevision).toBe(i + 1);
      expect(game.tvView(s).inkRevision).toBe(s.inkRevision);
      for (const id of [...Object.keys(s.players), 'spectator'])
        expect(game.controllerView(s, id).inkRevision).toBe(s.inkRevision);
    }
    const reveal = kit.vip(s, 'skip', s.began + 1000);
    expect(reveal.inkRevision).toBe(4);
    expect(kit.timer(reveal).inkRevision).toBe(0);
  });

  it('unauthorized, disconnected, paused and stale drawing messages do not acknowledge ink', () => {
    const s = drawing();
    for (const id of [guesser(s), 'spectator', '__proto__']) {
      for (const input of [
        { type: 'stroke', stroke },
        { type: 'undo' },
        { type: 'clear' },
      ] as Input[]) {
        expect(kit.input(s, id, input).inkRevision).toBe(0);
      }
    }
    const dropped = kit.player(s, s.drawer, false, undefined, s.began + 100);
    expect(
      kit.input(dropped, s.drawer, { type: 'stroke', stroke }, s.began + 200).inkRevision,
    ).toBe(0);
    const paused = kit.vip(s, 'pause', s.began + 100);
    expect(kit.input(paused, s.drawer, { type: 'stroke', stroke }, s.began + 200).inkRevision).toBe(
      0,
    );
    const painted = kit.input(s, s.drawer, { type: 'stroke', stroke }, s.began + 1000);
    expect(
      kit.input(painted, s.drawer, { type: 'stroke', stroke }, s.began + 999).inkRevision,
    ).toBe(1);
    const back = kit.player(
      kit.player(painted, guesser(s), false, undefined, s.began + 1200),
      guesser(s),
      true,
      undefined,
      s.began + 1300,
    );
    expect(back.inkRevision).toBe(1);
  });

  it('each solver sees their own earned points immediately and through reveal, without seeing the word', () => {
    const s = drawing();
    const id = guesser(s);
    const solved = kit.input(s, id, { type: 'guess', text: s.word }, s.began + 6000);
    const mine = game.controllerView(solved, id);
    expect(mine.myPoints).toBe(860);
    expect(mine.answer).toBeUndefined();
    expect(mine.secret).toBeUndefined();
    expect(game.controllerView(solved, s.drawer).myPoints).toBe(0);
    expect(game.controllerView(solved, 'spectator').myPoints).toBe(0);
    expect(game.controllerView(solved, '__proto__').myPoints).toBe(0);
    expect(game.controllerView(kit.vip(solved, 'skip', s.began + 8000), id).myPoints).toBe(860);
  });
});
