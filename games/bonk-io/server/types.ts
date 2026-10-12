import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['ready', 'play', 'score', 'done'] as const;
export const ROUNDS = 5;
export const READY_MS = 3000;
export const SCORE_MS = 4000;
/** Shared drawing geometry; phones import this tiny module without downloading server physics. */
export const BALL_RADIUS = 28;

export type Input = { type: 'control'; move: -1 | 0 | 1; heavy: boolean; jump: boolean };
export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Ball {
  id: string;
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  move: -1 | 0 | 1;
  heavy: boolean;
  grounded: boolean;
  /** Time after round start: controls older than the last accepted control are stale. */
  controlAt: number;
  coyote: number;
  jumpQueued: boolean;
  diedAt: number | null;
  cause: 'fall' | 'left' | null;
}
export interface World {
  balls: Ball[];
  /** Last complete 40 ms step. A control arriving between steps takes effect on the next one. */
  stepped: number;
  layout: number;
}
export type RoundOutcome = 'last-standing' | 'timeout' | 'draw' | null;
export interface State extends GameStateBase {
  began: number;
  endsAt: number;
  checked: number;
  world: World;
  round: number;
  rounds: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  lastWinners: string[];
  roundOutcome: RoundOutcome;
  left: string[];
  spawnOffset: number;
  phoneOnly?: true;
}
export type Transition = (state: State, now: number) => State;
