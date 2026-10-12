import type { Input } from '../server/types';

export const MOVE_CONFIRM_MS = 2000;
export const MOVE_COOLDOWN_MS = 150;

export interface MoveSnapshot {
  key: string;
  moves: number;
  score: number;
  active: boolean;
}

export interface MoveFeedback {
  key: string;
  moves: number;
  score: number;
  pendingAt: number | null;
  readyAt: number;
  gain: number;
  failed: boolean;
}

export function initialFeedback(view: MoveSnapshot): MoveFeedback {
  return {
    key: view.key,
    moves: view.moves,
    score: view.score,
    pendingAt: null,
    readyAt: 0,
    gain: 0,
    failed: false,
  };
}

/** Predict only whether the visible board can change, never a merge, spawn or score. */
export function directionChanges(board: readonly number[], dir: Input['dir']): boolean {
  for (let lane = 0; lane < 4; lane++) {
    const positions = Array.from({ length: 4 }, (_, step) =>
      dir === 'left'
        ? lane * 4 + step
        : dir === 'right'
          ? lane * 4 + 3 - step
          : dir === 'up'
            ? step * 4 + lane
            : (3 - step) * 4 + lane,
    );
    const tiles = positions.map((index) => board[index] ?? 0).filter((value) => value > 0);
    if (tiles.some((value, index) => value === tiles[index + 1])) return true;
    if (tiles.some((value, index) => board[positions[index]!] !== value)) return true;
  }
  return false;
}

/** A reload/new race establishes a baseline; only a newer authoritative counter is a receipt. */
export function observeMove(
  current: MoveFeedback,
  view: MoveSnapshot,
  now: number,
): { state: MoveFeedback; accepted: boolean } {
  if (current.key !== view.key || view.moves < current.moves)
    return { state: initialFeedback(view), accepted: false };
  if (view.moves > current.moves) {
    return {
      state: {
        ...initialFeedback(view),
        gain: Math.max(0, view.score - current.score),
        readyAt: now + MOVE_COOLDOWN_MS,
      },
      accepted: true,
    };
  }
  if (!view.active)
    return { state: { ...current, pendingAt: null, failed: false }, accepted: false };
  if (current.pendingAt !== null && now - current.pendingAt >= MOVE_CONFIRM_MS)
    return { state: { ...current, pendingAt: null, failed: true }, accepted: false };
  if (current.readyAt > 0 && now >= current.readyAt)
    return { state: { ...current, readyAt: 0 }, accepted: false };
  return { state: current, accepted: false };
}

/** At most one direction is in flight. The wire counter always comes from the accepted view. */
export function reserveMove(
  current: MoveFeedback,
  view: MoveSnapshot,
  board: readonly number[],
  dir: Input['dir'],
  now: number,
): MoveFeedback | null {
  if (
    !view.active ||
    current.pendingAt !== null ||
    now < current.readyAt ||
    !directionChanges(board, dir)
  )
    return null;
  return { ...current, pendingAt: now, failed: false };
}
