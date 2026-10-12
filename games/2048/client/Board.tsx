import { useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { MOTION_BASE, usePrefersReducedMotion, useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import { STRINGS } from './strings';
import styles from './Board.module.css';

type Direction = Input['dir'];
type TravellingTile = { from: number; to: number; value: number; merged: boolean };
type AppearingTile = { to: number; value: number };
export type BoardTransition = {
  direction: Direction;
  sources: TravellingTile[];
  merges: AppearingTile[];
  spawn: AppearingTile;
};

const DIRECTIONS: readonly Direction[] = ['left', 'up', 'down', 'right'];
const sameBoard = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const validBoard = (board: readonly number[]): boolean =>
  board.length === 16 &&
  board.every(
    (value) =>
      value === 0 ||
      (Number.isSafeInteger(value) && value >= 2 && Number.isInteger(Math.log2(value))),
  );

/** Recover only the provenance of an already accepted board. This never picks a move,
 * spawn, score or random draw; every proposed destination must match the server snapshot. */
function candidate(
  before: readonly number[],
  after: readonly number[],
  direction: Direction,
): BoardTransition | null {
  const landed = Array<number>(16).fill(0);
  const sources: TravellingTile[] = [];
  const merges: AppearingTile[] = [];
  for (let lane = 0; lane < 4; lane++) {
    const cells = Array.from({ length: 4 }, (_, offset) => {
      if (direction === 'left') return lane * 4 + offset;
      if (direction === 'right') return lane * 4 + 3 - offset;
      if (direction === 'up') return offset * 4 + lane;
      return (3 - offset) * 4 + lane;
    });
    const occupied = cells.filter((index) => before[index] !== 0);
    let destination = 0;
    for (let next = 0; next < occupied.length; next++) {
      const from = occupied[next]!;
      const to = cells[destination++]!;
      const partner = occupied[next + 1];
      const merged = partner !== undefined && before[from] === before[partner];
      sources.push({ from, to, value: before[from]!, merged });
      landed[to] = before[from]!;
      if (merged) {
        sources.push({ from: partner, to, value: before[partner]!, merged: true });
        landed[to] *= 2;
        merges.push({ to, value: landed[to]! });
        next++;
      }
    }
  }
  if (sameBoard(before, landed)) return null;
  let spawn: AppearingTile | null = null;
  for (let index = 0; index < 16; index++) {
    if (landed[index] === after[index]) continue;
    if (spawn || landed[index] !== 0 || (after[index] !== 2 && after[index] !== 4)) return null;
    spawn = { to: index, value: after[index]! };
  }
  return spawn ? { direction, sources, merges, spawn } : null;
}

/** A reload, skipped receipt, no-op or ambiguous remote board settles without fictitious travel.
 * A local direction is useful only when it validates against exactly one accepted move. */
export function boardTransition(
  before: readonly number[],
  after: readonly number[],
  previousMoves: number,
  moves: number,
  direction?: Direction,
): BoardTransition | null {
  if (
    !Number.isSafeInteger(previousMoves) ||
    previousMoves < 0 ||
    moves !== previousMoves + 1 ||
    !validBoard(before) ||
    !validBoard(after)
  )
    return null;
  if (direction !== undefined)
    return DIRECTIONS.includes(direction) ? candidate(before, after, direction) : null;
  const candidates = DIRECTIONS.map((dir) => candidate(before, after, dir)).filter(
    (transition): transition is BoardTransition => transition !== null,
  );
  return candidates.length === 1 ? candidates[0]! : null;
}

function tilePosition(to: number, from = to): CSSProperties {
  return {
    '--tile-col': to % 4,
    '--tile-row': Math.floor(to / 4),
    '--from-x': (from % 4) - (to % 4),
    '--from-y': Math.floor(from / 4) - Math.floor(to / 4),
  } as CSSProperties;
}

export function Board({
  board,
  label,
  miniature = false,
  tvMap = false,
  moves = 0,
  direction,
}: {
  board: readonly number[];
  label: string;
  miniature?: boolean;
  tvMap?: boolean;
  moves?: number;
  direction?: Direction;
}): JSX.Element {
  const L = useT(STRINGS);
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(() => ({
    board: [...board],
    moves,
    motion: null as BoardTransition | null,
  }));
  // Adjust before paint so a received board never flashes its final tiles ahead of travel.
  if (frame.moves !== moves || !sameBoard(frame.board, board)) {
    setFrame({
      board: [...board],
      moves,
      motion: reduced ? null : boardTransition(frame.board, board, frame.moves, moves, direction),
    });
  }
  const motion = reduced ? null : frame.motion;
  useEffect(() => {
    if (!frame.motion) return;
    if (reduced) {
      setFrame((current) => (current.motion ? { ...current, motion: null } : current));
      return;
    }
    // SDK base = 100ms travel + 200ms appearance. Clean up when another receipt arrives.
    const timer = setTimeout(
      () => setFrame((current) => (current === frame ? { ...current, motion: null } : current)),
      MOTION_BASE,
    );
    return () => clearTimeout(timer);
  }, [frame, reduced]);
  return (
    <div
      className={styles.board}
      role="grid"
      aria-label={label}
      aria-readonly="true"
      data-mini={miniature ? 'true' : undefined}
      data-tv-map={tvMap ? 'true' : undefined}
      data-moving={motion ? 'true' : undefined}
    >
      <div className={styles.cells}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} role="row" className={styles.row}>
            {[0, 1, 2, 3].map((col) => {
              const value = board[row * 4 + col] ?? 0;
              return (
                <span
                  key={col}
                  className={styles.tile}
                  role="gridcell"
                  data-value={value}
                  data-digits={String(value).length}
                  aria-label={
                    value
                      ? L('Row {row}, column {col}: {value}', { row: row + 1, col: col + 1, value })
                      : L('Row {row}, column {col}: empty', { row: row + 1, col: col + 1 })
                  }
                >
                  {value || null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {motion ? (
        <div className={styles.motion} key={moves} aria-hidden="true">
          {motion.sources.map((tile) => (
            <span
              key={`from:${tile.from}`}
              className={`${styles.tile} ${styles.movingTile}`}
              style={tilePosition(tile.to, tile.from)}
              data-value={tile.value}
              data-digits={String(tile.value).length}
              data-motion="travel"
              data-merged={tile.merged || undefined}
            >
              {tile.value}
            </span>
          ))}
          {[...motion.merges, motion.spawn].map((tile, index) => (
            <span
              key={`appear:${tile.to}`}
              className={`${styles.tile} ${styles.movingTile}`}
              style={tilePosition(tile.to)}
              data-value={tile.value}
              data-digits={String(tile.value).length}
              data-motion={index < motion.merges.length ? 'merge' : 'spawn'}
            >
              {tile.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
