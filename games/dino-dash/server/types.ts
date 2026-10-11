import type { GameStateBase } from '@partybox/game-sdk';
import type { World } from './world';

export const PHASES = ['play', 'score', 'done'] as const;
export const SCORE_MS = 4500;
export interface State extends GameStateBase {
  round: number;
  settings: { rounds: number };
  began: number;
  endsAt: number;
  world: World;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  phoneOnly: boolean;
  left: string[];
}
export type Transition = (state: State, now: number) => State;
