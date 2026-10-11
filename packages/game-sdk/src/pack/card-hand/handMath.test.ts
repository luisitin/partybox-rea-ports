// CardHand's geometry and ordering (T-0342): every card whole on an iPhone SE at any count, the
// arrangement kept across draws, sorts stable, and a magnet that picks the nearest target.
import { describe, expect, it } from 'vitest';
import {
  fanLayout,
  moveIds,
  nearestSlot,
  nearestTarget,
  reconcileOrder,
  sortIds,
} from './handMath';
import type { SortCard } from './types';

/** An iPhone SE in portrait: 375 px less the screen's 16 px gutters; the hand gets about 190 px. */
const SE = { w: 343, h: 190 };
/** Every corner of every card, turned about its bottom centre as the CSS does, is in the box. */
const inside = (count: number, w: number, h: number): void => {
  const layout = fanLayout(count, w, h);
  const { cardW: cw, cardH: ch } = layout;
  for (const s of layout.slots) {
    const a = (s.rotate * Math.PI) / 180;
    const px = s.x + cw / 2,
      py = s.y + ch;
    for (const [dx, dy] of [
      [-cw / 2, 0],
      [cw / 2, 0],
      [-cw / 2, -ch],
      [cw / 2, -ch],
    ] as const) {
      const x = px + dx * Math.cos(a) - dy * Math.sin(a);
      const y = py + dx * Math.sin(a) + dy * Math.cos(a);
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(x).toBeLessThanOrEqual(w + 0.01);
      expect(y).toBeGreaterThanOrEqual(-0.01);
      expect(y).toBeLessThanOrEqual(h + 0.01);
    }
  }
};

describe('fanLayout', () => {
  it('fits 11 cards in one readable row on an iPhone SE', () => {
    const layout = fanLayout(11, SE.w, SE.h);
    expect(layout.rows).toBe(1);
    expect(layout.step).toBeGreaterThanOrEqual(22);
    expect(layout.cardW).toBeGreaterThanOrEqual(80);
    inside(11, SE.w, SE.h);
  });

  it('adds a row instead of shrinking a sliver past readable, and never leaves the box', () => {
    const layout = fanLayout(24, SE.w, SE.h);
    expect(layout.rows).toBe(2);
    expect(layout.step).toBeGreaterThanOrEqual(20);
    expect(layout.step).toBeGreaterThanOrEqual(layout.cardW * 0.28 - 0.01);
    for (const n of [0, 1, 2, 5, 7, 10, 11, 12, 15, 20, 24, 30, 40]) inside(n, SE.w, SE.h);
    for (const n of [1, 11, 24]) inside(n, 640, 160); // a landscape phone
  });

  it('centres a lone card and fans the rest symmetrically', () => {
    const one = fanLayout(1, SE.w, SE.h);
    expect(one.slots[0]!.x).toBeCloseTo((SE.w - one.cardW) / 2);
    expect(one.slots[0]!.rotate).toBe(0);
    const five = fanLayout(5, SE.w, SE.h);
    expect(five.slots[0]!.rotate).toBeCloseTo(-five.slots[4]!.rotate);
    expect(five.slots[2]!.rotate).toBeCloseTo(0);
  });

  it('keeps room above the cards for a picked card to rise into', () => {
    const layout = fanLayout(8, SE.w, SE.h);
    expect(layout.lift).toBeGreaterThanOrEqual(10);
    expect(Math.min(...layout.slots.map((s) => s.y))).toBeGreaterThanOrEqual(layout.lift);
  });

  it('sits at the bottom of a tall box, under the thumb', () => {
    const layout = fanLayout(11, SE.w, 400);
    const bottom = Math.max(...layout.slots.map((s) => s.y + layout.cardH));
    expect(bottom).toBeGreaterThan(400 - 12);
    expect(bottom).toBeLessThanOrEqual(400);
  });
});

describe('nearestSlot', () => {
  it('is the slot whose centre is nearest the finger', () => {
    const layout = fanLayout(6, SE.w, SE.h);
    const s = layout.slots[3]!;
    expect(nearestSlot(layout, s.x + layout.cardW / 2, s.y + layout.cardH / 2)).toBe(3);
    expect(nearestSlot(layout, -50, 100)).toBe(0);
    expect(nearestSlot(layout, SE.w + 50, 100)).toBe(5);
  });
});

const card = (id: string, rank: number, suit: string): SortCard => ({ id, rank, suit });
const HAND = [
  card('a', 7, 'red'),
  card('b', 3, 'blue'),
  card('c', 7, 'blue'),
  card('d', 12, 'green'),
  card('e', 3, 'red'),
  card('f', 7, 'green'),
];

describe('reconcileOrder', () => {
  it('keeps the arrangement, drops played cards and adds drawn ones at the end', () => {
    const before = ['f', 'e', 'd', 'c', 'b', 'a'];
    const now = [...HAND.filter((c) => c.id !== 'd'), card('g', 1, 'red')];
    expect(reconcileOrder(before, now)).toEqual(['f', 'e', 'c', 'b', 'a', 'g']);
  });

  it('puts a drawn card in its sorted place while a sort is on', () => {
    const now = [...HAND, card('g', 4, 'red')];
    expect(reconcileOrder([], now, (cs) => sortIds(cs, 'rank', ['red', 'blue', 'green']))).toEqual([
      'e',
      'b',
      'g',
      'a',
      'c',
      'f',
      'd',
    ]);
  });
});

describe('moveIds', () => {
  it('moves one card, or a picked group in its order, to a place among the rest', () => {
    expect(moveIds(['a', 'b', 'c', 'd'], ['a'], 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveIds(['a', 'b', 'c', 'd'], ['d', 'b'], 0)).toEqual(['b', 'd', 'a', 'c']);
    expect(moveIds(['a', 'b', 'c'], ['b'], 99)).toEqual(['a', 'c', 'b']);
    expect(moveIds(['a', 'b', 'c'], ['b'], -3)).toEqual(['b', 'a', 'c']);
  });
});

describe('sortIds', () => {
  const colours = ['red', 'yellow', 'green', 'blue'];
  it('sorts by number, then colour', () => {
    expect(sortIds(HAND, 'rank', colours)).toEqual(['e', 'b', 'a', 'f', 'c', 'd']);
  });
  it('groups by colour in the given order, then number', () => {
    expect(sortIds(HAND, 'suit', colours)).toEqual(['e', 'a', 'f', 'd', 'b', 'c']);
  });
  it('takes colours in the order first seen when none is given', () => {
    expect(sortIds(HAND, 'suit')).toEqual(['e', 'a', 'b', 'c', 'f', 'd']);
  });
  it('puts equal numbers together, the biggest group first', () => {
    expect(sortIds(HAND, 'sets', colours)).toEqual(['a', 'f', 'c', 'e', 'b', 'd']);
  });
  it("uses a game's own order as given", () => {
    const own = { id: 'phase', label: 'Phase', order: () => ['d', 'a', 'b', 'c', 'e', 'f'] };
    expect(sortIds(HAND, own)).toEqual(['d', 'a', 'b', 'c', 'e', 'f']);
  });
});

describe('nearestTarget', () => {
  const piles = [
    { id: 'draw', left: 20, top: 20, width: 70, height: 100 },
    { id: 'discard', left: 110, top: 20, width: 70, height: 100 },
  ];
  it('takes a card over a target or within the magnet, and nothing farther', () => {
    expect(nearestTarget(piles, 50, 60)).toBe('draw');
    expect(nearestTarget(piles, 110 + 70 + 20, 60)).toBe('discard');
    expect(nearestTarget(piles, 300, 60)).toBeNull();
    expect(nearestTarget(piles, 50, 200)).toBeNull();
  });
  it('picks the nearer centre where two magnets overlap', () => {
    expect(nearestTarget(piles, 97, 60)).toBe('draw');
    expect(nearestTarget(piles, 104, 60)).toBe('discard');
  });
});
