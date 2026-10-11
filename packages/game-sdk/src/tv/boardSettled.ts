import { MOTION_SLOW } from '../ui/motion';
import { boardLandedMs } from './Scoreboard';
import { CLIMB_LANDED_MS, climbLandedMs } from './climb';

/** T-0279: when a board's totals and ranks have finished landing (ms after mount): the TV strip
 *  holds its previous totals until then (`stripScores`), so it never shows what the board is still
 *  counting toward. Pass the same options the board gets. */
export function boardSettledMs(
  count: number,
  opts: {
    compact?: boolean;
    dense?: boolean;
    columns?: 2 | 3 | 4;
    stagger?: 'up' | 'down' | 'climb' | false;
    holdMs?: number;
    /** With `climb`: how many rows slide (T-0280: each mover lands a beat after the last). Without
     *  it the worst case is used. */
    movers?: number;
  } = {},
): number {
  if (opts.stagger === 'climb')
    return opts.movers === undefined ? CLIMB_LANDED_MS : climbLandedMs(opts.movers);
  return Math.max(boardLandedMs(count, opts), opts.holdMs ?? 0) + MOTION_SLOW;
}
