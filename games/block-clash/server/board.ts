// A single settled lock: line clears cancel queued garbage before the rest is inserted.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { GARBAGE_PER_LOCK, LINE_ATTACK, LINE_POINTS, SPIN_ATTACK, SPIN_POINTS } from './content';
import { cells, fits, KINDS } from './pieces';
import { pieceAt } from './sequence';
import { placement } from './strategy';
import { H, LOCK_MS, W } from './types';
import type { Board, Grid, PieceKind, State } from './types';

export function emptyGrid(): Grid {
  return Array.from({ length: H }, () => Array<number>(W).fill(0));
}
export function gravity(state: State, now: number): number {
  return Math.max(250, 650 - Math.floor(Math.max(0, now - state.began) / 30_000) * 100);
}
export function topped(board: Board, now: number): Board {
  return { ...board, alive: false, active: null, diedAt: now, lockAt: null, plan: null };
}
export function spawn(state: State, board: Board, now: number, kind?: PieceKind): Board {
  const active = {
    kind: kind ?? pieceAt(state.pieceSeed, board.sequence),
    x: 3,
    y: -1,
    rotation: 0 as const,
  };
  const spawned: Board = {
    ...board,
    active,
    sequence: board.sequence + (kind === undefined ? 1 : 0),
    nextFall: now + gravity(state, now),
    lockAt: null,
    lockResets: 0,
    lastRotate: false,
    plan: null,
  };
  if (!fits(board.grid, active)) return topped(spawned, now);
  return {
    ...spawned,
    lockAt: fits(board.grid, { ...active, y: active.y + 1 }) ? null : now + LOCK_MS,
    plan: state.players[board.id]?.bot
      ? placement(board.grid, active, state.botSkill, `${board.id}:${spawned.sequence}`)
      : null,
  };
}
function spin(board: Board): boolean {
  const piece = board.active;
  if (!piece || piece.kind !== 'T' || !board.lastRotate) return false;
  const blocked = (x: number, y: number): boolean =>
    x < 0 || x >= W || y >= H || (y >= 0 && board.grid[y]![x] !== 0);
  return (
    [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ].filter(([dx, dy]) => blocked(piece.x + dx!, piece.y + dy!)).length >= 3
  );
}
export interface Locked {
  board: Board;
  rng: RngState;
  outgoing: number;
}
export function lockBoard(state: State, board: Board, now: number, rng: RngState): Locked {
  if (!board.alive || !board.active) return { board, rng, outgoing: 0 };
  const points = cells(board.active);
  if (points.some(([, y]) => y < 0)) return { board: topped(board, now), rng, outgoing: 0 };
  const isSpin = spin(board);
  let grid = board.grid.map((row) => [...row]);
  for (const [x, y] of points) grid[y]![x] = KINDS.indexOf(board.active.kind) + 1;
  const count = grid.filter((row) => row.every((cell) => cell !== 0)).length;
  grid = grid.filter((row) => row.some((cell) => cell === 0));
  while (grid.length < H) grid.unshift(Array<number>(W).fill(0));
  const difficult = count > 0 && (count === 4 || isSpin);
  const combo = count > 0 ? board.combo + 1 : -1;
  const base = isSpin ? (SPIN_POINTS[count] ?? 0) : (LINE_POINTS[count] ?? 0);
  const score =
    board.score + base * (difficult && board.b2b ? 1.5 : 1) + (count > 0 ? combo * 50 : 0);
  const attack =
    (isSpin ? (SPIN_ATTACK[count] ?? 0) : (LINE_ATTACK[count] ?? 0)) +
    (difficult && board.b2b ? 1 : 0) +
    (count > 0 ? Math.max(0, Math.floor(combo / 2)) : 0);
  const cancelled = Math.min(board.pending, attack);
  let pending = board.pending - cancelled;
  const outgoing = attack - cancelled;
  let next: Board = {
    ...board,
    grid,
    score,
    lines: board.lines + count,
    attack: board.attack + outgoing,
    pending,
    combo,
    b2b: count > 0 ? difficult : board.b2b,
    canHold: true,
    active: null,
  };
  const add = Math.min(pending, GARBAGE_PER_LOCK);
  for (let n = 0; n < add; n++) {
    if (grid[0]!.some((cell) => cell !== 0)) {
      next = topped(next, now);
      break;
    }
    const [hole, nextRng] = nextInt(rng, 0, W - 1);
    rng = nextRng;
    grid = [...grid.slice(1), Array.from({ length: W }, (_, x) => (x === hole ? 0 : 8))];
    pending--;
    next = { ...next, grid, pending };
  }
  return { board: next.alive ? spawn(state, next, now) : next, rng, outgoing };
}
