// The climb (Scoreboard stagger="climb"): where each row stood, when it slides, in what z-order.
import { MOTION_BASE, MOTION_SLOW } from '../ui/motion';
import type { ScoreboardRow } from './row';

/** T-0280: the first mover slides at 1200 ms; each next one (new-index order) follows a beat
 *  later, the whole stagger capped at CLIMB_SPREAD_MS so a 16-row board still lands inside ~2.4 s.
 *  Every slide runs --pb-motion-slow. */
export const CLIMB_START_MS = 1200;
/** The climbers' shrink starts this long before the first slide, so it is full by then (F22). */
export const CLIMB_LANE_LEAD_MS = 100;
const CLIMB_STEP_MS = 75;
const CLIMB_SPREAD_MS = 600;

/** When a climbing board with `movers` sliding rows has landed (ms after mount). */
export function climbLandedMs(movers: number): number {
  if (movers <= 0) return MOTION_BASE; // nothing slides: what climbPlan lands at
  return CLIMB_START_MS + climbStep(movers) * (movers - 1) + MOTION_SLOW;
}
/** The worst case (any number of movers): what a caller without the count waits. */
export const CLIMB_LANDED_MS = climbLandedMs(1 + CLIMB_SPREAD_MS / CLIMB_STEP_MS);

function climbStep(movers: number): number {
  return movers > 1 ? Math.min(CLIMB_STEP_MS, CLIMB_SPREAD_MS / (movers - 1)) : 0;
}

export interface ClimbRow {
  shift: number;
  hop: boolean;
  col: number;
  /** 'hold' stays put; 'rise' / 'fall' slide (or hop) to the new place. */
  kind: 'hold' | 'rise' | 'fall';
  /** When this row's slide starts and lands (ms after mount). Holders land at 0. */
  startMs: number;
  landMs: number;
}

/** T-0280: one FLIP move per row with a fixed stagger. Movers start in new-index order, one step
 *  apart, so the board resolves top to bottom and two rows never trade places in the same frame. */
export function climbPlan(
  previous: readonly string[],
  ids: readonly string[],
  perCol: number,
): { rows: ClimbRow[]; landedMs: number } {
  const base = ids.map((id, index) => {
    const s = climbShift(previous, id, index, perCol);
    const moved = s.shift !== 0 || s.hop;
    const up = climbOffset(previous, id, index);
    return { ...s, moved, kind: !moved ? ('hold' as const) : up > 0 ? ('rise' as const) : ('fall' as const) }; // prettier-ignore
  });
  const movers = base.filter((b) => b.moved).length;
  const step = climbStep(movers);
  let k = 0;
  const rows = base.map((b) => {
    if (!b.moved) return { shift: b.shift, hop: b.hop, col: b.col, kind: b.kind, startMs: 0, landMs: 0 }; // prettier-ignore
    const startMs = CLIMB_START_MS + step * k++;
    return { shift: b.shift, hop: b.hop, col: b.col, kind: b.kind, startMs, landMs: startMs + MOTION_SLOW }; // prettier-ignore
  });
  return { rows, landedMs: movers > 0 ? climbLandedMs(movers) : MOTION_BASE };
}

/** T-0198: each row's rank before this round (by `score − delta`, ties shared: "1, 2, 2, 4"), so a
 *  climbing board wears the old ranks until its rows land — the final ones gave the reorder away.
 *  Everyone level before (after round 1): no ranks yet (null, the held "·"), not a 16-way tie. */
export function climbRanks(
  rows: readonly Pick<ScoreboardRow, 'score' | 'delta'>[],
): (number | null)[] {
  const before = rows.map((r) => r.score - (r.delta ?? 0));
  if (before.every((b) => b === before[0])) return before.map(() => null);
  return before.map((b) => 1 + before.filter((o) => o > b).length);
}

/** I-027: how many rows away a row is from where it stood before — the slide starts that many
 *  rows down, so positive = it stood lower = it climbed (pass 865: the glows read it backwards).
 *  A row that was not on the previous board has not moved. */
export function climbOffset(previous: readonly string[], id: string, index: number): number {
  const was = previous.indexOf(id);
  return (was < 0 ? index : was) - index;
}

/** Per-row climb vars: the slide's start, when its glow and delta land, and a stable z-order
 *  (climbers over, holders mid, fallers under; the bigger the climb the higher). */
export const climbVars = (r: ClimbRow, holdDeltaAt: number): Record<string, string | number> => ({
  '--pb-from': r.shift,
  '--pb-col-from': r.col,
  '--pb-start': `${r.startMs}ms`,
  '--pb-land': `${r.landMs}ms`,
  '--pb-delta-at': `${r.kind === 'hold' ? holdDeltaAt : r.landMs}ms`,
  zIndex: r.kind === 'rise' ? 30 + Math.min(Math.abs(r.shift), 9) : r.kind === 'hold' ? 20 : r.hop ? 5 : 10, // a hopping faller sits under its column-mates (F23)
}); // prettier-ignore

/** T-0191: the climb on a multi-column board. A row that stays in its column slides that many rows
 *  (`shift`); a row whose old place is in another column would fly diagonally over its neighbours,
 *  so it `hops` instead: it stays at its old place (`col` columns and `shift` rows away) until the
 *  slide, fades out there and fades in at its new place (T-0262: it used to leave a hole). */
export function climbShift(
  previous: readonly string[],
  id: string,
  index: number,
  perCol: number,
): { shift: number; hop: boolean; col: number } {
  const was = previous.indexOf(id);
  const at = was < 0 ? index : was;
  const col = Math.floor(at / perCol) - Math.floor(index / perCol);
  if (col !== 0) return { shift: (at % perCol) - (index % perCol), hop: true, col };
  return { shift: at - index, hop: false, col: 0 };
}
