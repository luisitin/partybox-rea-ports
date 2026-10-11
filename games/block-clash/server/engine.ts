// Advance gravity and locks chronologically. Simultaneous locks send attacks after every board settles.
import { hasPlayer, z } from '@partybox/game-sdk';
import { GARBAGE_CAP } from './content';
import { gravity, lockBoard, spawn } from './board';
import { dropY, fits, rotate } from './pieces';
import { LOCK_MS, MAX_RESETS } from './types';
import type { ActivePiece, Board, Input, State } from './types';
export { emptyGrid } from './board';

export const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), direction: z.enum(['left', 'right', 'down']) }),
  z.object({ type: z.literal('rotate'), direction: z.enum(['cw', 'ccw']) }),
  z.object({ type: z.literal('drop') }),
  z.object({ type: z.literal('hold') }),
  z.object({ type: z.literal('target'), playerId: z.string().min(1).max(128) }),
]);

export function finished(state: State): boolean {
  return state.checked >= state.endsAt || state.boards.filter((board) => board.alive).length <= 1;
}
function replace(state: State, board: Board): State {
  return { ...state, boards: state.boards.map((b) => (b.id === board.id ? board : b)) };
}
export function normalizeTargets(state: State): State {
  return {
    ...state,
    boards: state.boards.map((board) => ({
      ...board,
      target: !board.alive
        ? null
        : (state.boards.find(
            (rival) => rival.id === board.target && rival.id !== board.id && rival.alive,
          )?.id ??
          state.boards.find((rival) => rival.id !== board.id && rival.alive)?.id ??
          null),
    })),
  };
}
function lockMany(state: State, ids: string[], now: number): State {
  let rng = state.rng;
  const outgoing: { id: string; target: string | null; count: number }[] = [];
  let boards = state.boards.map((board) => {
    if (!ids.includes(board.id)) return board;
    const locked = lockBoard(state, board, now, rng);
    rng = locked.rng;
    outgoing.push({ id: board.id, target: board.target, count: locked.outgoing });
    return locked.board;
  });
  for (const send of outgoing) {
    const rival =
      boards.find((b) => b.id === send.target && b.id !== send.id && b.alive) ??
      boards.find((b) => b.id !== send.id && b.alive);
    if (rival && send.count > 0)
      boards = boards.map((b) =>
        b.id === rival.id ? { ...b, pending: Math.min(GARBAGE_CAP, b.pending + send.count) } : b,
      );
  }
  return normalizeTargets({ ...state, boards, rng });
}
export function lockPiece(state: State, id: string, now: number): State {
  return lockMany(state, [id], now);
}
function grounded(board: Board, active: ActivePiece): boolean {
  return !fits(board.grid, { ...active, y: active.y + 1 });
}
function moved(board: Board, active: ActivePiece, now: number, rotation: boolean): Board {
  const wasGrounded = board.active !== null && grounded(board, board.active);
  const reset = wasGrounded && board.lockResets < MAX_RESETS;
  const lockAt = grounded(board, active)
    ? reset
      ? now + LOCK_MS
      : (board.lockAt ?? (board.lockResets >= MAX_RESETS ? now : now + LOCK_MS))
    : null;
  return {
    ...board,
    active,
    lockAt,
    lockResets: board.lockResets + (reset ? 1 : 0),
    lastRotate: rotation,
    lastInputAt: now,
  };
}

export function applyInput(state: State, id: string, input: Input, now: number): State {
  if (!hasPlayer(state, id)) return state;
  const board = state.boards.find((b) => b.id === id);
  if (!board?.alive || !board.active) return state;
  const piece = board.active;
  if (input.type === 'target') {
    const rival = state.boards.find((b) => b.id === input.playerId && b.id !== id && b.alive);
    return rival && board.target !== rival.id
      ? replace(state, { ...board, target: rival.id, lastInputAt: now })
      : state;
  }
  if (input.type === 'hold') {
    if (!board.canHold) return state;
    const held = board.hold;
    const next = spawn(
      state,
      { ...board, hold: piece.kind, canHold: false, lastInputAt: now },
      now,
      held ?? undefined,
    );
    return next.alive ? replace(state, next) : normalizeTargets(replace(state, next));
  }
  if (input.type === 'drop') {
    const y = dropY(board.grid, piece);
    const landed = {
      ...board,
      active: { ...piece, y },
      score: board.score + (y - piece.y) * 2,
      lastInputAt: now,
    };
    return lockPiece(replace(state, landed), id, now);
  }
  if (input.type === 'rotate') {
    const active = rotate(board.grid, piece, input.direction);
    return active ? replace(state, moved(board, active, now, true)) : state;
  }
  const dx = input.direction === 'left' ? -1 : input.direction === 'right' ? 1 : 0;
  const dy = input.direction === 'down' ? 1 : 0;
  const active = { ...piece, x: piece.x + dx, y: piece.y + dy };
  if (!fits(board.grid, active)) {
    return dy && board.lockAt === null
      ? replace(state, { ...board, lockAt: now + LOCK_MS })
      : state;
  }
  const next = moved(board, active, now, false);
  return replace(state, { ...next, score: next.score + dy });
}

export function settle(state: State, now: number): State {
  if (finished(state)) return state;
  const to = Math.max(state.checked, Math.min(now, state.endsAt));
  if (to <= state.checked) return state;
  let next = state;
  // Each iteration advances to a real board event; the two-minute cap bounds the work.
  while (!finished(next)) {
    let at = Infinity;
    for (const board of next.boards)
      if (board.alive) at = Math.min(at, board.nextFall, board.lockAt ?? Infinity);
    if (at > to || !Number.isFinite(at)) break;
    next = {
      ...next,
      checked: at,
      boards: next.boards.map((board) => {
        if (!board.alive || !board.active || board.nextFall > at) return board;
        const active = { ...board.active, y: board.active.y + 1 };
        const falls = fits(board.grid, active);
        const moved = {
          ...board,
          active: falls ? active : board.active,
          nextFall: at + gravity(next, at),
          lastRotate: falls ? false : board.lastRotate,
        };
        return {
          ...moved,
          lockAt: grounded(moved, moved.active)
            ? (board.lockAt ?? (board.lockResets >= MAX_RESETS ? at : at + LOCK_MS))
            : null,
        };
      }),
    };
    const locks = next.boards
      .filter((board) => board.alive && board.lockAt !== null && board.lockAt <= at)
      .map((board) => board.id);
    if (locks.length) next = lockMany(next, locks, at);
    if (finished(next)) return next;
  }
  return { ...next, checked: to };
}
