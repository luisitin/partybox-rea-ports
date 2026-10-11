// JSON state for the shared seeded course and each player's independent climb.
import type { GameStateBase, GameEvent } from '@partybox/game-sdk';

export const PHASES = ['play', 'score', 'done'] as const;
export const ROUND_MS = 45_000;
export const SCORE_MS = 6000;
export const STEP_MS = 20;
export const TICK_MS = 100;
export const TAP_MS = 140;
export const GRAVITY = 420;
export const IMPULSE = 190;
export const RETRY_MS = 1200;
export const GAP = 120;

export interface Input {
  type: 'tap';
}
export interface Gate {
  height: number;
  offset: number;
  beatMs: number;
  direction: number;
  colourAfter: number;
}
export interface Runner {
  id: string;
  y: number;
  velocity: number;
  gates: number;
  colour: number;
  floor: number;
  lastTap: number;
  respawnAt: number | null;
  crashes: number;
  bestHeight: number;
  launched: boolean;
}
export interface World {
  runners: Runner[];
  gates: Gate[];
  checked: number;
}
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  round: number;
  settings: { rounds: number };
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  phoneOnly: boolean;
}
export type Transition = (state: State, now: number) => State;
export type PhaseReducer = (state: State, event: GameEvent<Input>, next: Transition) => State;
