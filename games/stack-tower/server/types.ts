// JSON state of a 45-second tower race. Every completed floor is public.
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'done'] as const;
export const ROUND_MS = 45_000;
export const SCORE_MS = 6000;
export const TICK_MS = 50;
export const RESTART_MS = 650;

export interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Tower {
  id: string;
  attempt: number;
  height: number;
  best: number;
  perfects: number;
  streak: number;
  footprint: Block;
  blocks: Block[];
  bestBlocks: Block[];
  movingSince: number;
  lastAt: number;
  crashedAt: number | null;
  feedback: 'align' | 'trim' | 'perfect' | 'grow' | 'miss';
  cut: { axis: 'x' | 'z'; amount: number; side: number } | null;
}

export interface State extends GameStateBase {
  began: number;
  endsAt: number;
  checked: number;
  course: number;
  towers: Tower[];
  scores: Record<string, number>;
  phoneOnly: boolean;
}
