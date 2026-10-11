// Ranked score list. Ties share a rank; the top rank is celebrated. Used by the core results
// screen and by games that show standings between rounds.
// Tiers keep any count on a 1080p stage under a heading: roomy (≤ 4, h2 rows), tight (5–6, body
// rows), dense (7–12, two h2 columns), tight3 (13+, three body columns); the multi-column tiers
// flow column-major so ranks read down, not across.
// Entrance (TV tiers; off on compact): rows rise one by one, each delta lands a beat after its
// row, and once the last row is in every total counts up from (score − delta) together (counting
// while rows were still arriving read as two competing motions — review-loop #32); the leader's
// trophy pops last. Everything runs on the motion tokens, so reduced motion renders the final
// board at once.
import { Fragment, useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import type { ViewPlayer } from '@partybox/shared';
import { Avatar } from '../ui/Avatar';
import { useT } from '../ui/lang';
import { MOTION_BASE, MOTION_FAST, MOTION_SLOW, useBeats, useCountUp } from '../ui/motion';
import type { ScoreboardRow } from './row';
import { CLIMB_LANE_LEAD_MS, CLIMB_START_MS, climbPlan, climbRanks, climbVars } from './climb';
import { RankCell } from './RankCell';
import { rankBand, tieEdges, tieSpansColumns } from './ties';
import styles from './Scoreboard.module.css';
import { STRINGS } from './strings';

export type { ScoreboardRow } from './row';

export interface ScoreboardProps {
  rows: ScoreboardRow[];
  /** Compact variant for the controller. */
  compact?: boolean;
  highlightId?: string | null;
  /** Hide the 🏆 (everyone tied, or nobody scored). */
  noTrophy?: boolean;
  /** Force (true) or suppress (false) the two-column tier; 13+ rows always go three-column. */
  dense?: boolean;
  /** `lg`: large rows for a board that owns the stage (results at 7–8 players, review-loop #32);
   *  `sm`: body-size rows for a two-column board under a tall header (a 12-player wager screen,
   *  review-loop #53). */
  size?: 'sm' | 'md' | 'lg';
  /** `3` / `4`: that many body-size columns from any count — a board under a three- or four-row
   *  roster (Lightning's wager page: two columns of six rows ran into the host bar at 12 players,
   *  and three columns of six clipped at 16). */
  columns?: 2 | 3 | 4;
  /** Rows to mark with a ✓ in the delta slot when they carry no delta (e.g. "wager placed"). */
  markIds?: readonly string[];
  /**
   * Entrance order: `up` (default) lands last place first and the leader last; `down` lands rank
   * 1 first at half spacing (standings before a decision); `false` renders the board at once.
   * Ignored on `compact`. Remount (a `key`) to replay it. `climb` (I-027): rows appear where they
   * stood in `climbFrom` (player ids, previous order), then slide to their new places once the
   * totals have counted — the round's overtakes, watched.
   */
  stagger?: 'up' | 'down' | 'climb' | false;
  /** I-019: hold every total as "—" this long after mount, then count up from zero (a reveal). */
  holdMs?: number;
  /** I-128 B: no rank numbers (an all-zero board has nothing to rank). */
  noRanks?: boolean;
  /** With `climb`: the previous order of the same players (ids). Missing ids are treated as unmoved. */
  climbFrom?: readonly string[];
  /** How a score reads (default: the plain number). A game whose score is a time passes its seconds
   *  here (Fire Away: `secs`). Only the text changes: the order, the ties and the count-up run on numbers. */
  format?: (score: number) => string;
}

type Tier = 'compact' | 'roomy' | 'tight' | 'dense' | 'tight3' | 'tight4';

const COLUMNS: Record<Tier, number> = {
  compact: 1,
  roomy: 1,
  tight: 1,
  dense: 2,
  tight3: 3,
  tight4: 4,
};

export function tierOf(
  count: number,
  compact?: boolean,
  dense?: boolean,
  columns?: 2 | 3 | 4,
): Tier {
  if (compact) return 'compact';
  if (columns === 4) return 'tight4';
  // An explicit two columns holds at 13+ rows too (T-0191: Hive Rank asked for 2 and drew 3).
  if (columns === 3 || (count >= 13 && columns !== 2)) return 'tight3';
  if (dense ?? count >= 7) return 'dense';
  if (count >= 5) return 'tight';
  return 'roomy';
}

/** When the last row of a staggered board has risen (ms after mount): the totals count up from
 *  here, and a game can deal whatever sits beside the board on this beat instead of guessing.
 *  Compact boards do not stagger, so they land at once. */
export function boardLandedMs(
  count: number,
  opts: {
    compact?: boolean;
    dense?: boolean;
    columns?: 2 | 3 | 4;
    stagger?: 'up' | 'down' | 'climb' | false;
  } = {},
): number {
  if (opts.compact || opts.stagger === false) return 0;
  if (opts.stagger === 'climb') return MOTION_BASE; // rows fade in together; the deltas follow
  const cols = COLUMNS[tierOf(count, opts.compact, opts.dense, opts.columns)];
  // Half spacing on the multi-column tiers and for `down`, so 16 rows still land inside ~1.2 s;
  // mirrors --pb-stagger-step in the CSS.
  const stepMs = cols > 1 || opts.stagger === 'down' ? MOTION_FAST / 2 : MOTION_FAST;
  return stepMs * Math.max(0, count - 1) + MOTION_BASE;
}

/** A score as text: the game's `format`, or the plain number. */
function readScore(score: number, format?: (score: number) => string): string {
  return format ? format(score) : String(score);
}

/** The total, counting up from its pre-delta value once the board has landed. */
function Score({
  row,
  delayMs,
  holdMs = 0,
  format,
}: {
  row: ScoreboardRow;
  delayMs: number;
  holdMs?: number;
  format?: (score: number) => string;
}): JSX.Element {
  // I-019 A: with a hold the total shows "—" until the hold has passed, then counts up from zero.
  const start = Math.max(delayMs, holdMs);
  const held = useHeld(holdMs);
  const shown = useCountUp(
    row.score,
    holdMs > 0 ? 0 : row.score - (row.delta ?? 0),
    MOTION_SLOW,
    start,
  );
  return <span className={styles.score}>{held ? '—' : readScore(shown, format)}</span>;
}

/** True until `ms` after mount (0 = never held). */
function useHeld(ms: number): boolean {
  const [held, setHeld] = useState(ms > 0);
  useEffect(() => {
    if (ms <= 0) return;
    const t = setTimeout(() => setHeld(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return held;
}

export function Scoreboard({
  rows,
  compact,
  highlightId,
  noTrophy,
  dense,
  size = 'md',
  columns,
  markIds = [],
  stagger = 'up',
  climbFrom = [],
  holdMs = 0,
  noRanks = false,
  format,
}: ScoreboardProps): JSX.Element {
  const L = useT(STRINGS);
  const tier = tierOf(rows.length, compact, dense, columns);
  const cols = COLUMNS[tier];
  const winners = rows.filter((r) => r.rank === 1).length;
  const trophy = !noTrophy && winners < rows.length;
  const climb = !compact && stagger === 'climb';
  const heldRanks = useHeld(holdMs); // I-019 A: ranks show "·" through the hold as well
  // T-0198: a climb shows the old ranks (and no tie badges or bands, which follow the new order)
  // until the rows have slid home; reduced motion lands at once.
  const perColEarly = Math.ceil(rows.length / cols);
  const plan = climb
    ? climbPlan(
        climbFrom,
        rows.map((r) => r.playerId),
        perColEarly,
      )
    : null;
  const landed = useBeats([0, plan?.landedMs ?? 0]) === 1 || !climb;
  const oldRanks = climbRanks(rows);
  const staggered = !compact && stagger !== false && !climb;
  const order = (index: number): number => (stagger === 'down' ? index : rows.length - 1 - index);
  const countDelayMs = boardLandedMs(rows.length, { compact, dense, columns, stagger });
  const perCol = perColEarly;
  const ranks = rows.map((r) => r.rank);
  // T-0181: the winners' tie is their trophies, so a 🏆 row wears no badge
  // T-0280: a tie is a tinted chip inside each tied row's own rank cell (two rows sharing a
  // number), so nothing paints past the rows
  const tieClass = (i: number): string => {
    const tie =
      noRanks || !landed || (ranks[i] === 1 && trophy) ? null : tieEdges(ranks, i, perCol);
    return tie ? (styles.tied ?? '') : '';
  };
  const bandFor = (index: number): string | null =>
    cols < 2 || noRanks || !landed || tieSpansColumns(ranks, perCol)
      ? null
      : rankBand(ranks, index, perCol);
  return (
    <ol
      className={`${styles.board} ${tier === 'roomy' ? '' : styles[tier]} ${size === 'lg' ? styles.lg : size === 'sm' ? styles.sm : ''} ${staggered ? styles.staggered : ''} ${staggered && stagger === 'down' ? styles.down : ''} ${climb ? styles.climb : ''} ${climb && cols > 1 ? styles.columns : ''} ${noRanks ? styles.noRanks : ''}`}
      style={
        {
          '--pb-board-rows': Math.ceil(rows.length / cols),
          // the climbers' shrink spans the whole climb: from the first slide, held past the last landing
          '--pb-lane-run': plan
            ? `${Math.max(0, plan.landedMs - CLIMB_START_MS + CLIMB_LANE_LEAD_MS) / 0.8}ms`
            : undefined,
        } as CSSProperties
      }
      aria-label={L('scoreboard')}
    >
      {rows.map((row, index) => {
        const climbRow = plan?.rows[index];
        return (
          <li
            key={row.playerId}
            className={`${styles.row} ${tieClass(index)} ${row.rank === 1 && trophy ? styles.top : ''} ${row.playerId === highlightId ? styles.me : ''} ${climbRow?.kind === 'rise' ? styles.rose : ''} ${climbRow?.kind === 'fall' ? styles.fell : ''} ${climbRow?.hop ? styles.hop : ''}`}
            aria-current={row.playerId === highlightId ? 'true' : undefined}
            // T-0192: a game styles every tied row by rank (Blanks lifts each rank-1 row as one piece).
            data-rank={row.rank}
            style={
              staggered
                ? ({ '--pb-i': order(index) } as CSSProperties)
                : climbRow
                  ? (climbVars(climbRow, row.delta ? MOTION_BASE : 0) as CSSProperties)
                  : undefined
            }
          >
            {bandFor(index) ? (
              <span className={styles.band} aria-hidden>
                {bandFor(index)}
              </span>
            ) : null}
            {/* no ranks (a team's card): no rank slot at all, so the name gets its room (reviewer 69417f) */}
            {noRanks ? null : (
              <RankCell
                row={row}
                oldRank={oldRanks[index] ?? null}
                // a mover's rank swaps as its own row lands; a holder's once the board is done
                // (round 1 has no old ranks to hide: everyone shows the real one from the start)
                landAtMs={
                  oldRanks[index] == null
                    ? 0
                    : climbRow && climbRow.kind !== 'hold'
                      ? climbRow.landMs
                      : (plan?.landedMs ?? 0)
                }
                climb={climb}
                tied={landed && ranks.filter((r) => r === row.rank).length > 1}
                held={heldRanks}
                trophy={trophy}
              />
            )}
            <Avatar
              avatarId={row.avatarId}
              dim={row.connected === false}
              size={compact ? 32 : 'var(--pb-chip-size)'}
            />
            <span className={styles.name}>
              {/* one span per word: on a phone a long name wraps at its spaces and a word too wide for
                the row ends in its own ellipsis, never "Maximilia / no…" (session-c ec3ea7) */}
              {row.name.split(' ').map((word, i) => (
                <Fragment key={i}>
                  {i > 0 ? ' ' : null}
                  <span className={styles.word}>{word}</span>
                </Fragment>
              ))}
              {row.tags?.length ? (
                <span className={styles.tags}>{row.tags.join(' · ')}</span>
              ) : null}
            </span>
            {row.delta ? (
              // a loss reads as one, "−25" (Mystery Box's coins go down: "+-25", T-0043)
              <span className={`${styles.delta} ${row.delta < 0 ? styles.loss : ''}`}>
                {row.delta < 0
                  ? `−${readScore(-row.delta, format)}`
                  : `+${readScore(row.delta, format)}`}
              </span>
            ) : markIds.includes(row.playerId) ? (
              <span className={styles.mark} aria-label={L('wager placed')}>
                ✓
              </span>
            ) : null}
            {staggered || climb ? (
              <Score row={row} delayMs={countDelayMs} holdMs={holdMs} format={format} />
            ) : (
              <span className={styles.score}>{readScore(row.score, format)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Audit #6: the standings board every game assembled for this Scoreboard — each row's name, face
// and link from the view's roster, and where the rows stood before this round (the `climb`). Here,
// beside the board the phones load at join, so a game pays nothing for them.

/** A row of a view's standings, as the server ranks it. */
export interface StandingLike {
  playerId: string;
  score: number;
  rank: number;
  /** Points this round (the climb's "before" is `score − delta`). */
  delta?: number;
}

/** The view's standings as Scoreboard rows: the roster's name, face and link on each row. */
export function boardRows<R extends StandingLike>(
  players: readonly ViewPlayer[],
  rows: readonly R[],
): (R & { name: string; avatarId: string; connected: boolean })[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.playerId);
    return { ...r, name: p?.name ?? '?', avatarId: p?.avatarId ?? 'ghost', connected: p?.connected ?? false }; // prettier-ignore
  });
}

/**
 * Where each row stood before this round, for Scoreboard's `climbFrom`: by the score before the
 * round's delta; ties in `roster` order (Wisecrack's I-027 rule) or, without a roster, in the
 * rows' own order.
 */
export function climbOrder(
  rows: readonly Pick<StandingLike, 'playerId' | 'score' | 'delta'>[],
  roster?: readonly { id: string }[],
): string[] {
  const seat = new Map((roster ?? []).map((p, i) => [p.id, i]));
  const before = (r: Pick<StandingLike, 'score' | 'delta'>): number => r.score - (r.delta ?? 0);
  return [...rows]
    .sort(
      (a, b) => before(b) - before(a) || (seat.get(a.playerId) ?? 0) - (seat.get(b.playerId) ?? 0),
    )
    .map((r) => r.playerId);
}
