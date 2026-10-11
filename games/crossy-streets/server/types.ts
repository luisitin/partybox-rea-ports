import type { GameStateBase } from '@partybox/game-sdk';
import type { World } from './world';
export type { Direction, Input, Lane, LaneObject, Runner, World } from './world';

export const PHASES = ['play', 'score', 'done'] as const;
export const SCORE_MS = 8000;

export interface State extends GameStateBase {
  /** Absolute server clocks. All clocks in the world are milliseconds after began. */
  began: number;
  endsAt: number;
  checked: number;
  seconds: number;
  world: World;
  /** Each runner's greatest safely reached row, never the sum of repeat hops. */
  scores: Record<string, number>;
  phoneOnly?: true;
}

export type Transition = (state: State, now: number) => State;
