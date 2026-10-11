// Random-access seven bags keep the identical sequence bounded even for very fast players.
import { seedRng, shuffle } from '@partybox/game-sdk';
import { KINDS } from './pieces';
import type { Board, PieceKind, State } from './types';

export function pieceAt(seed: number, index: number): PieceKind {
  const bag = Math.floor(Math.max(0, index) / 7);
  const [pieces] = shuffle({ ...seedRng(seed), step: bag * 6 }, KINDS);
  return pieces[Math.max(0, index) % 7] as PieceKind;
}
export function nextPieces(state: State, board: Board, count = 3): PieceKind[] {
  return Array.from({ length: Math.max(0, Math.min(5, count)) }, (_, i) =>
    pieceAt(state.pieceSeed, board.sequence + i),
  );
}
