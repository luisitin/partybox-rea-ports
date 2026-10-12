// Original implementation of a four-by-four sliding, once-per-turn merge board.
import type { Direction, Spawn } from './types';

export interface Slide {
  board: number[];
  gain: number;
  changed: boolean;
}

function indices(dir: Direction, lane: number): number[] {
  return Array.from({ length: 4 }, (_, step) => {
    if (dir === 'left') return lane * 4 + step;
    if (dir === 'right') return lane * 4 + 3 - step;
    if (dir === 'up') return step * 4 + lane;
    return (3 - step) * 4 + lane;
  });
}

export function slide(board: number[], dir: Direction): Slide {
  const next = [...board];
  let gain = 0;
  for (let lane = 0; lane < 4; lane++) {
    const cells = indices(dir, lane);
    const values = cells.map((i) => board[i] ?? 0).filter((v) => v !== 0);
    const out: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const a = values[i] ?? 0;
      if (i + 1 < values.length && a !== values[i + 1]) {
        out.push(a * 2);
        gain += a * 2;
        i++;
      } else out.push(a);
    }
    cells.forEach((cell, i) => {
      next[cell] = out[i] ?? 0;
    });
  }
  return { board: next, gain, changed: next.some((v, i) => v !== board[i]) };
}

export function canMove(board: number[]): boolean {
  for (let i = 0; i < 16; i++) {
    const value = board[i] ?? 0;
    if (value === 0) return true;
    if (i % 4 < 3 && value === board[i + 1]) return true;
    if (i < 12 && value === board[i + 4]) return true;
  }
  return false;
}

export function spawn(board: number[], draw: Spawn): number[] {
  const empty = board.flatMap((v, i) => (v === 0 ? [i] : []));
  if (empty.length === 0) return board;
  const cell = empty[Math.floor((draw.slot * empty.length) / 65536)];
  if (cell === undefined) return board;
  const next = [...board];
  next[cell] = draw.value;
  return next;
}
