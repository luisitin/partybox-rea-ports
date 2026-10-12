import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board, boardTransition } from './Board';

function cells(entries: Record<number, number>): number[] {
  return Array.from({ length: 16 }, (_, index) => entries[index] ?? 0);
}

describe('accepted board animation provenance', () => {
  it('recovers a unique remote slide and identifies its one new tile', () => {
    const before = cells({ 1: 2, 3: 4 });
    const after = cells({ 0: 2, 1: 4, 15: 2 });
    expect(boardTransition(before, after, 7, 8)).toEqual({
      direction: 'left',
      sources: [
        { from: 1, to: 0, value: 2, merged: false },
        { from: 3, to: 1, value: 4, merged: false },
      ],
      merges: [],
      spawn: { to: 15, value: 2 },
    });
    expect(before).toEqual(cells({ 1: 2, 3: 4 }));
    expect(after).toEqual(cells({ 0: 2, 1: 4, 15: 2 }));
  });

  it('retains both source positions for each pair and never merges a result twice', () => {
    expect(
      boardTransition(
        cells({ 0: 2, 1: 2, 2: 2, 3: 2 }),
        cells({ 0: 4, 1: 4, 15: 4 }),
        0,
        1,
        'left',
      ),
    ).toEqual({
      direction: 'left',
      sources: [
        { from: 0, to: 0, value: 2, merged: true },
        { from: 1, to: 0, value: 2, merged: true },
        { from: 2, to: 1, value: 2, merged: true },
        { from: 3, to: 1, value: 2, merged: true },
      ],
      merges: [
        { to: 0, value: 4 },
        { to: 1, value: 4 },
      ],
      spawn: { to: 15, value: 4 },
    });
  });

  it('does not confuse an existing equal tile with a newly merged result', () => {
    const plan = boardTransition(
      cells({ 0: 2, 1: 2, 2: 4 }),
      cells({ 0: 4, 1: 4, 15: 2 }),
      3,
      4,
      'left',
    );
    expect(plan?.sources).toEqual([
      { from: 0, to: 0, value: 2, merged: true },
      { from: 1, to: 0, value: 2, merged: true },
      { from: 2, to: 1, value: 4, merged: false },
    ]);
    expect(plan?.merges).toEqual([{ to: 0, value: 4 }]);
  });

  it.each([
    ['left', 3, 0],
    ['right', 0, 3],
    ['up', 12, 0],
    ['down', 0, 12],
  ] as const)('travels along %s from the actual source cell', (direction, from, to) => {
    const plan = boardTransition(cells({ [from]: 8 }), cells({ [to]: 8, 15: 2 }), 5, 6, direction);
    expect(plan?.sources).toEqual([{ from, to, value: 8, merged: false }]);
    expect(plan?.spawn).toEqual({ to: 15, value: 2 });
  });

  it('settles ambiguous remote boards but validates a direction bound to the local receipt', () => {
    const before = cells({ 0: 2 });
    const after = cells({ 3: 2, 12: 2 });
    expect(boardTransition(before, after, 2, 3)).toBeNull();
    expect(boardTransition(before, after, 2, 3, 'right')?.spawn).toEqual({ to: 12, value: 2 });
    expect(boardTransition(before, after, 2, 3, 'down')?.spawn).toEqual({ to: 3, value: 2 });
    expect(boardTransition(before, after, 2, 3, 'left')).toBeNull();
  });

  it('settles duplicate, skipped and reset receipts without replaying historical moves', () => {
    const before = cells({ 1: 2, 3: 4 });
    const after = cells({ 0: 2, 1: 4, 15: 2 });
    for (const [previous, next] of [
      [7, 7],
      [7, 9],
      [7, 0],
      [-1, 0],
      [0.5, 1.5],
    ]) {
      expect(boardTransition(before, after, previous!, next!, 'left')).toBeNull();
    }
  });

  it('refuses no-ops and outcomes without exactly one legal spawn', () => {
    const still = cells({ 0: 2 });
    expect(boardTransition(still, still, 0, 1, 'left')).toBeNull();
    expect(boardTransition(still, cells({ 0: 2, 15: 2 }), 0, 1, 'left')).toBeNull();
    const before = cells({ 1: 2, 3: 4 });
    for (const after of [
      cells({ 0: 2, 1: 4 }),
      cells({ 0: 2, 1: 4, 15: 8 }),
      cells({ 0: 2, 1: 4, 14: 2, 15: 2 }),
      cells({ 0: 4, 1: 4, 15: 2 }),
    ])
      expect(boardTransition(before, after, 0, 1, 'left')).toBeNull();
  });

  it('rejects malformed snapshots without creating decorative tiles', () => {
    const after = cells({ 0: 2, 1: 4, 15: 2 });
    for (const before of [[], cells({ 1: 3 }), cells({ 1: -2 }), cells({ 1: Infinity })]) {
      expect(boardTransition(before, after, 0, 1, 'left')).toBeNull();
    }
    expect(
      boardTransition(cells({ 1: 2, 3: 4 }), cells({ 0: 2, 1: NaN, 15: 2 }), 0, 1, 'left'),
    ).toBeNull();
  });
});

describe('genuine opening animation', () => {
  it('keeps all 16 current semantic cells while only its occupied tiles spawn', () => {
    const html = renderToStaticMarkup(
      <Board board={cells({ 4: 2, 8: 4 })} label="Your board" animateInitial />,
    );
    expect(html.match(/role="gridcell"/g)).toHaveLength(16);
    expect(html).toContain('aria-label="Row 2, column 1: 2"');
    expect(html).toContain('aria-label="Row 3, column 1: 4"');
    expect(html).toContain('data-moving="true"');
    expect(html.match(/data-motion="spawn"/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('data-motion="travel"');
    expect(html).not.toContain('data-motion="merge"');
  });

  it('settles reloads by default and never replays a board with accepted moves', () => {
    for (const props of [{ moves: 0 }, { moves: 11, animateInitial: true }]) {
      const html = renderToStaticMarkup(
        <Board board={cells({ 4: 2, 8: 2 })} label="Your board" {...props} />,
      );
      expect(html.match(/role="gridcell"/g)).toHaveLength(16);
      expect(html).not.toContain('data-moving="true"');
      expect(html).not.toContain('data-motion="spawn"');
    }
  });
});
