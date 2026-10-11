// Match state around the public octagonal arena. Every clock is injected by the engine.
import type { GameStateBase } from '@partybox/game-sdk';
import type { World } from './world';

export const PHASES = ['play', 'score', 'done'] as const;
export const SCORE_MS = 6000;

export interface State extends GameStateBase {
  began: number;
  endsAt: number;
  /** Last completed physics sample, in milliseconds after began. */
  checked: number;
  world: World;
  scores: Record<string, number>;
}

export type Transition = (state: State, now: number) => State;
