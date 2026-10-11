import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { emptyGrid } from '../server/engine';
import type { Board, State } from '../server/types';

export const kit = testKit(game, { t0: 1_000_000, players: testPlayers(4) });

export function playing(players = 4, seed = 1): State {
  return game.init({ players: testPlayers(players), settings: {}, seed, now: kit.t0 });
}

export function boardState(overrides: Partial<Board>, state = playing()): State {
  return {
    ...state,
    boards: state.boards.map((board, index) =>
      index === 0 ? { ...board, grid: emptyGrid(), ...overrides } : board,
    ),
  };
}

export function first(state: State): Board {
  return state.boards[0]!;
}

export function withWell(rows: number, holeColumns: readonly number[]): number[][] {
  const grid = emptyGrid();
  for (let y = 20 - rows; y < 20; y++) {
    grid[y] = Array.from({ length: 10 }, (_, x) => (holeColumns.includes(x) ? 0 : 8));
  }
  return grid;
}
