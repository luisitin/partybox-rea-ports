// JSON state and public board shapes. Future pieces and bot plans stay server-side.
import type { BotSkill, ControllerView, GameStateBase, TvView } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'done'] as const;
export const ROUND_MS = 120_000;
export const TICK_MS = 250;
export const LOCK_MS = 500;
export const MAX_RESETS = 15;
export const W = 10;
export const H = 20;
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rotation = 0 | 1 | 2 | 3;
export type Grid = number[][];
export interface ActivePiece {
  kind: PieceKind;
  x: number;
  y: number;
  rotation: Rotation;
}
export interface Plan {
  x: number;
  rotation: Rotation;
}
export interface Board {
  id: string;
  grid: Grid;
  active: ActivePiece | null;
  alive: boolean;
  score: number;
  lines: number;
  attack: number;
  pending: number;
  target: string | null;
  sequence: number;
  hold: PieceKind | null;
  canHold: boolean;
  nextFall: number;
  lockAt: number | null;
  lockResets: number;
  diedAt: number | null;
  lastRotate: boolean;
  lastInputAt: number;
  combo: number;
  b2b: boolean;
  plan: Plan | null;
}
export interface State extends GameStateBase {
  boards: Board[];
  pieceSeed: number;
  began: number;
  endsAt: number;
  checked: number;
  botSkill: BotSkill;
  phoneOnly: boolean;
}
export type Input =
  | { type: 'move'; direction: 'left' | 'right' | 'down' }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'drop' }
  | { type: 'hold' }
  | { type: 'target'; playerId: string };
export type Transition = (state: State, now: number) => State;
export interface BoardView {
  id: string;
  name: string;
  grid: Grid;
  active: ActivePiece | null;
  ghostY: number;
  alive: boolean;
  score: number;
  lines: number;
  attack: number;
  pending: number;
  target: string | null;
}
export interface Standing {
  id: string;
  name: string;
  score: number;
  lines: number;
  survivedMs: number;
  alive: boolean;
  rank: number;
}
export interface MatchView {
  screen: 'play' | 'score' | 'done';
  boards: BoardView[];
  standings: Standing[];
  began: number;
  endsAt: number;
  checked: number;
  remainingMs: number;
}
export type BlockClashTvView = TvView & MatchView;
export type BlockClashControllerView = ControllerView &
  MatchView & {
    board: BoardView | null;
    next: PieceKind[];
    hold: PieceKind | null;
    canHold: boolean;
  };
