// The board's landing beat (what counts up, and what a game deals beside the board, wait for).
import { boardSettledMs } from './boardSettled';
import { describe, expect, it } from 'vitest';

import { MOTION_BASE } from '../ui/motion';
import { boardLandedMs, tierOf } from './Scoreboard';
import {
  CLIMB_LANDED_MS,
  climbLandedMs,
  climbOffset,
  climbPlan,
  climbRanks,
  climbShift,
  climbVars,
} from './climb';
import { rankBand, tieEdges, tieSpansColumns } from './ties';

describe('boardLandedMs', () => {
  it('lands one row per 150 ms in a single column, plus the last rise', () => {
    expect(boardLandedMs(1)).toBe(300);
    expect(boardLandedMs(3)).toBe(600);
    expect(boardLandedMs(4)).toBe(750);
  });

  it('halves the step on the two- and three-column tiers, so 16 rows land inside ~1.5 s', () => {
    expect(tierOf(12, false, true)).toBe('dense');
    expect(boardLandedMs(12, { dense: true })).toBe(11 * 75 + 300);
    expect(boardLandedMs(16)).toBe(15 * 75 + 300);
    // A five-row board forced dense lands sooner than the same rows in one column.
    expect(boardLandedMs(5, { dense: true })).toBeLessThan(boardLandedMs(5));
  });

  it('takes the three-column tier from any count when asked (a board under a tall roster)', () => {
    expect(tierOf(12, false, true, 3)).toBe('tight3');
    expect(tierOf(16, false, undefined, 4)).toBe('tight4');
    expect(boardLandedMs(16, { columns: 4 })).toBe(boardLandedMs(16));
    expect(tierOf(9, false, undefined, 3)).toBe('tight3');
    expect(tierOf(9, false, undefined, 2)).toBe('dense');
    // T-0191: an explicit two columns holds at 13+ rows too.
    expect(tierOf(16, false, undefined, 2)).toBe('dense');
    expect(tierOf(16)).toBe('tight3');
    // Compact still wins, and the landing time follows the column count.
    expect(tierOf(9, true, undefined, 3)).toBe('compact');
    expect(boardLandedMs(12, { columns: 3 })).toBe(boardLandedMs(12, { dense: true }));
  });

  it('is instant when the board does not stagger', () => {
    expect(boardLandedMs(8, { compact: true })).toBe(0);
    expect(boardLandedMs(8, { stagger: false })).toBe(0);
  });
});

describe('climbShift (T-0191)', () => {
  it('slides a row within its column and hops one whose old place is in another column', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f'];
    // two columns of three: a b c | d e f
    expect(climbShift(before, 'c', 0, 3)).toEqual({ shift: 2, hop: false, col: 0 }); // c climbs within column 1
    expect(climbShift(before, 'd', 0, 3)).toEqual({ shift: 0, hop: true, col: 1 }); // d jumps to column 1
    expect(climbShift(before, 'a', 3, 3)).toEqual({ shift: 0, hop: true, col: -1 }); // a drops to column 2
    expect(climbShift(before, 'e', 2, 3)).toEqual({ shift: -1, hop: true, col: 1 }); // T-0262: its old slot
    expect(climbShift(before, 'new', 4, 3)).toEqual({ shift: 0, hop: false, col: 0 });
    // one column: the plain offset
    expect(climbShift(before, 'f', 0, 6)).toEqual({ shift: 5, hop: false, col: 0 });
  });
});

describe('climbRanks (T-0198)', () => {
  it('ranks the rows by their score before this round, ties shared', () => {
    // the new board: Ana 400 (+300), Cleo 350 (+0), Bo 100 (+100)
    const rows = [
      { score: 400, delta: 300 },
      { score: 350, delta: 0 },
      { score: 100, delta: 100 },
    ];
    // before: Ana 100, Cleo 350, Bo 0
    expect(climbRanks(rows)).toEqual([2, 1, 3]);
    expect(climbRanks([{ score: 3 }, { score: 3, delta: 0 }, { score: 1, delta: 1 }])).toEqual([
      1, 1, 3,
    ]);
    // after round 1 everyone was level: no old ranks (the held "·"), not "1, 1" (a room-wide tie)
    expect(
      climbRanks([
        { score: 5, delta: 5 },
        { score: 2, delta: 2 },
      ]),
    ).toEqual([null, null]);
  });

  it('holds the old ranks until the last slide lands (T-0280: one step per mover, capped)', () => {
    expect(climbLandedMs(0)).toBe(MOTION_BASE);
    expect(climbLandedMs(1)).toBe(1800);
    expect(climbLandedMs(3)).toBe(1800 + 150);
    expect(climbLandedMs(16)).toBe(1800 + 600);
    expect(CLIMB_LANDED_MS).toBeGreaterThanOrEqual(climbLandedMs(16));
  });
});

describe('climbPlan (T-0280)', () => {
  it('starts movers one step apart in new-index order; holders never move', () => {
    const plan = climbPlan(['a', 'b', 'c', 'd'], ['c', 'a', 'b', 'd'], 4);
    expect(plan.rows.map((r) => r.kind)).toEqual(['rise', 'fall', 'fall', 'hold']);
    expect(plan.rows.map((r) => r.startMs)).toEqual([1200, 1275, 1350, 0]);
    expect(plan.rows.map((r) => r.landMs)).toEqual([1800, 1875, 1950, 0]);
    expect(plan.landedMs).toBe(1950);
  });
  it('caps the whole stagger, so a full reshuffle of 16 lands together', () => {
    const ids = Array.from({ length: 16 }, (_, i) => 'p' + i);
    const plan = climbPlan(ids, [...ids].reverse(), 16);
    expect(plan.landedMs).toBe(1800 + 600);
    expect(Math.max(...plan.rows.map((r) => r.startMs))).toBe(1800);
  });
  it('lands an unmoved board at the mount fade', () => {
    const plan = climbPlan(['a', 'b'], ['a', 'b'], 2);
    expect(plan.rows.every((r) => r.kind === 'hold')).toBe(true);
    expect(plan.landedMs).toBe(300);
  });
});

describe('climbOffset (I-027)', () => {
  it('is positive for a row that climbed (it starts the slide that many rows down), negative for one that fell', () => {
    const before = ['a', 'b', 'c'];
    expect(climbOffset(before, 'c', 0)).toBe(2); // third → first: climbed two rows
    expect(climbOffset(before, 'a', 2)).toBe(-2); // first → third: fell two rows
    expect(climbOffset(before, 'b', 1)).toBe(0); // held its place
    expect(climbOffset(before, 'new', 1)).toBe(0); // not on the previous board
  });
});

describe('tie brackets and rank bands (I-146)', () => {
  it('caps a tie at its first and last row, and leaves a lone rank alone', () => {
    const ranks = [1, 2, 2, 4, 4];
    expect(tieEdges(ranks, 0, 5)).toBeNull();
    expect(tieEdges(ranks, 1, 5)).toEqual({ top: true, end: false, on: false });
    expect(tieEdges(ranks, 2, 5)).toEqual({ top: false, end: true, on: false });
    expect(tieEdges(ranks, 4, 5)).toEqual({ top: false, end: true, on: false });
  });

  it('leaves a tie open where it runs past the foot of a column (T-0203)', () => {
    // 8 rows in two columns of four: rank 4 runs from the foot of column 1 into column 2.
    const ranks = [1, 2, 2, 4, 4, 4, 4, 4];
    // alone at the foot of its column: capped on top, open below
    expect(tieEdges(ranks, 3, 4)).toEqual({ top: true, end: false, on: true });
    expect(tieEdges(ranks, 4, 4)).toEqual({ top: false, end: false, on: false }); // carries on, no cap
    expect(tieEdges(ranks, 7, 4)).toEqual({ top: false, end: true, on: false });
  });

  it('brackets the sixth of a six-way tie alone at the head of column 2 (Cinema r10)', () => {
    const ranks = [1, 1, 1, 1, 1, 1, 7, 7, 9]; // nine rows, two columns of five
    expect(tieEdges(ranks, 4, 5)).toEqual({ top: false, end: false, on: true });
    expect(tieEdges(ranks, 5, 5)).toEqual({ top: false, end: true, on: false });
    expect(tieEdges(ranks, 6, 5)).toEqual({ top: true, end: false, on: false });
  });

  it("labels each split column's first row with the ranks it covers", () => {
    const ranks = [1, 2, 2, 4, 4, 4, 4, 4];
    expect(rankBand(ranks, 0, 4)).toBe('1–4');
    expect(rankBand(ranks, 4, 4)).toBe('4');
    expect(rankBand(ranks, 1, 4)).toBeNull();
    expect(rankBand([1, 2, 3, 4, 5, 6, 7], 4, 4)).toBe('5–7');
  });

  it('shows no band labels when a column carries a tie on into other ranks (hive-rank 489534)', () => {
    expect(tieSpansColumns([1, 1, 1, 1, 1, 1, 1, 8], 4)).toBe(true); // "1" | "1–8" would mislead
    expect(tieSpansColumns([1, 2, 2, 4, 4, 4, 4, 4], 4)).toBe(false); // "1–4" | "4" reads right
    expect(tieSpansColumns([1, 2, 3, 4, 5, 6, 7], 4)).toBe(false);
  });
});

describe('boardSettledMs', () => {
  it('a climb board settles at the worst case, or at its mover count', () => {
    expect(boardSettledMs(8, { stagger: 'climb' })).toBe(2400);
    expect(boardSettledMs(8, { stagger: 'climb', movers: 2 })).toBe(1875);
  });

  it('other boards settle one count-up after the last row lands (or the hold)', () => {
    expect(boardSettledMs(3, { stagger: 'up' })).toBe(boardLandedMs(3) + 600);
    expect(boardSettledMs(1, { holdMs: 1600 })).toBe(2200);
  });

  it('a hopping faller sits under a sliding one (T-0300 F23)', () => {
    const hopFall = { shift: 1, hop: true, col: 1, kind: 'fall', startMs: 0, landMs: 0 } as const;
    const fall = { ...hopFall, hop: false } as const;
    expect(climbVars(hopFall, 0).zIndex).toBeLessThan(climbVars(fall, 0).zIndex as number);
  });
});
