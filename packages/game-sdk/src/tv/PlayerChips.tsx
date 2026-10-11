// A row/grid of player chips built from the view envelope's `players[]`.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { ViewPlayer } from '@partybox/shared';
import { useT } from '../ui/lang';
import { PlayerChip } from '../ui/PlayerChip';
import { tallyChipKey } from '../ui/Tally';
import { STRINGS } from './strings';
import styles from './PlayerChips.module.css';

export interface PlayerChipsProps {
  players: ViewPlayer[];
  vip?: string | null;
  /** Ids to highlight. */
  activeIds?: string[];
  /** I-131 A: faces only — no names, no scores (a claim needs the height). */
  facesOnly?: boolean;
  /** I-131 B: this player's chip keeps its name and leads the row. */
  leadId?: string | null;
  /** I-070 C: players whose nudge is showing — their chip waves. */
  wavingIds?: string[];
  /** I-089 A: seconds of grace left per dropped player. */
  awayLeft?: Record<string, number>;
  /** I-045 B: players the room is waiting on — three pulsing dots over their dimmed avatar. */
  thinkingIds?: string[];
  showScores?: boolean;
  /** T-0290: the leaders when the game breaks ties its own way (Bingo: fastest bingo); default is everyone on the top score. */
  leaderIds?: readonly string[];
  /** The scores are held-over values, not live: rendered muted (review-loop #32). */
  scoresMuted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** `grid` wraps into rows (lobby), `row` stays on one line (game footer). */
  layout?: 'grid' | 'row';
  /** Grid alignment: centred by default; `start` lines up under a left-aligned heading. */
  align?: 'center' | 'start';
  /** Ids of bot players (they get a 🤖 tag). The room snapshot knows; the game view does not. */
  botIds?: readonly string[];
  /** Newly mounted chips pop in (lobby joins). Off by default: no pop on screen transitions. */
  enter?: boolean;
  /** Empty dashed seats rendered after the players (an empty lobby shows where people go). */
  seats?: number;
  /** The TV strip: go faces-only by itself when the named chips would take more than this many
   *  rows (Tune In: 10+ players pushed the stage up). Re-checked when the players change. */
  autoFacesPastRows?: number;
}

/** Rows of a wrapped list (distinct tops of its items). */
function rowsOf(el: HTMLElement): number {
  return new Set([...el.children].map((c) => (c as HTMLElement).offsetTop)).size;
}

/** More rows than `limit` in a wrapped list. */
function tooManyRows(el: HTMLElement, limit: number | undefined): boolean {
  return !!limit && rowsOf(el) > limit;
}

/** T-0178: a wrapped strip balances its rows (six chips wrapping read 5 + 1, one chip alone on
 *  row 2): the list narrows to its widest run of ⌈n / rows⌉ chips, so each row takes about as
 *  many, and never more rows than before (else it lets go). */
function balanceRows(el: HTMLElement): void {
  el.style.maxWidth = '';
  const rows = rowsOf(el);
  const n = el.children.length;
  if (rows < 2) return;
  const per = Math.ceil(n / rows);
  // layout widths (a popping chip's scale is not its size), each rounded: half a px of slack a chip
  const widths = [...el.children].map((c) => (c as HTMLElement).offsetWidth + 0.5);
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  let widest = 0;
  for (let i = 0; i + per <= n; i++) {
    const run = widths.slice(i, i + per).reduce((a, b) => a + b, 0) + gap * (per - 1);
    widest = Math.max(widest, run);
  }
  el.style.maxWidth = `${Math.ceil(widest) + 1}px`;
  if (rowsOf(el) > rows) el.style.maxWidth = '';
}

/** Who wears the leader mark. A game's own `leaderIds` (Bingo's tie-break) wins, unless the strip is
 *  held (muted): it shows old totals, so the mark follows them (T-0290). Else everyone on a top score
 *  that is not shared by all. */
export function chipLeaders(
  scored: readonly { id: string; score?: number }[],
  top: number,
  muted: boolean,
  leaderIds?: readonly string[],
): Set<string> {
  if (leaderIds && !muted) return new Set(top > 0 ? leaderIds : []);
  return top > 0 && scored.some((p) => p.score !== top)
    ? new Set(scored.filter((p) => p.score === top).map((p) => p.id))
    : new Set<string>();
}

export function PlayerChips({
  players,
  vip,
  activeIds = [],
  facesOnly = false,
  leadId = null,
  wavingIds = [],
  awayLeft = {},
  thinkingIds = [],
  showScores,
  scoresMuted = false,
  leaderIds,
  size = 'md',
  layout = 'row',
  align = 'center',
  botIds = [],
  enter = false,
  seats = 0,
  autoFacesPastRows,
}: PlayerChipsProps): JSX.Element {
  const L = useT(STRINGS);
  // Auto faces-only: the named chips are laid out, their rows counted (distinct tops), and past the
  // limit the strip drops the names. A new set of players starts over with names.
  const list = useRef<HTMLUListElement>(null);
  const key = players.map((p) => `${p.id}:${p.name}`).join('|');
  const [auto, setAuto] = useState<{ key: string; faces: boolean }>({ key, faces: false });
  if (auto.key !== key) setAuto({ key, faces: false });
  // Measured before the first paint (a layout effect), so a 16-player strip never shows its names
  // once and then collapses (tune-in's note); a resize is watched after that.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && !auto.faces && tooManyRows(el, autoFacesPastRows)) setAuto({ key, faces: true });
  }, [key, auto.faces, autoFacesPastRows]);
  useEffect(() => {
    const el = list.current;
    if (!el || !autoFacesPastRows || auto.faces) return undefined;
    const ro = new ResizeObserver(() => {
      if (tooManyRows(el, autoFacesPastRows)) setAuto({ key, faces: true });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFacesPastRows, auto.faces, key]);
  const faces = facesOnly || auto.faces;
  useEffect(() => {
    const box = list.current?.parentElement;
    if (layout !== 'row' || !box || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (list.current) balanceRows(list.current);
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [layout]);
  // Same rule as Scoreboard's 🏆: no leader mark when nobody has scored or everyone is tied.
  // Alphabetical everywhere chips appear (lobby, selecting, game strip), so a player finds their
  // chip in the same place on every screen; numeric-aware so Bot 2 precedes Bot 10 (review-loop #3).
  // When what a chip shows changes (a score or a badge changes its width), after the faces check
  // above; the strip's own box is watched for a resize. The lobby's grid centres its rows and is left
  // be. Not on every render: each pass writes the strip's max-width and reads its rows back, a forced
  // reflow of the whole page, and a TV re-renders ~30 times a second (T-0344 fix5).
  const shown = [
    players.map((p) => `${p.id}|${p.name}|${p.score}|${p.connected}`).join(';'),
    [botIds, leaderIds].map((x) => x?.join(',')).join('/'),
    awayLeft ? JSON.stringify(awayLeft) : '',
    scoresMuted,
    showScores,
    faces,
    size,
    vip,
    leadId,
    seats,
  ].join('#');
  useLayoutEffect(() => {
    if (layout === 'row' && list.current) balanceRows(list.current);
  }, [layout, shown]);
  const ordered = [...players].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  const scored = showScores ? ordered.filter((p) => p.score !== undefined) : [];
  const top = Math.max(0, ...scored.map((p) => p.score as number));
  const leaders = chipLeaders(scored, top, scoresMuted, leaderIds);
  return (
    <ul
      ref={list}
      className={`${styles.list} ${styles[layout]} ${align === 'start' ? styles.start : ''}`}
      aria-label={L('players')}
    >
      {ordered.map((p) => (
        <li
          key={p.id}
          className={`${styles.item} ${enter ? styles.enter : ''}`}
          data-tally-key={tallyChipKey(p.id)}
        >
          <PlayerChip
            name={faces && p.id !== leadId ? '' : p.name}
            avatarId={p.avatarId}
            connected={p.connected}
            status={p.status}
            isVip={vip === p.id}
            active={activeIds.includes(p.id)}
            waving={wavingIds.includes(p.id)}
            awayLeft={awayLeft[p.id] ?? null}
            thinking={thinkingIds.includes(p.id)}
            // a game's faces-only (a claim) drops the scores too; the automatic one drops only the
            // names, so a game that shows scores keeps them (face + score)
            score={showScores && !(facesOnly && p.id !== leadId) ? p.score : undefined}
            scoreMuted={scoresMuted}
            leader={leaders.has(p.id)}
            // faces only: the chip is its content — no empty ✓ slot, no 🤖 (a bot's face already
            // says so) — so the rows read as faces, not blank name tags (reviewer)
            isBot={botIds.includes(p.id) && !(faces && p.id !== leadId)}
            compact={faces && p.id !== leadId}
            size={p.id === leadId ? 'md' : size}
          />
        </li>
      ))}
      {Array.from({ length: Math.max(0, seats) }, (_, i) => (
        <li key={`seat-${i}`} className={styles.seat} aria-hidden="true">
          <span className={styles.seatDisc} />
        </li>
      ))}
    </ul>
  );
}
