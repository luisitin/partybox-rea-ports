// JSON-only match state. Flight times are relative to began, so a pause shifts one clock.
import type { GameStateBase } from '@partybox/game-sdk';
import type { World } from './world';

export const PHASES = ['play', 'score', 'done'] as const;
export const SCORE_MS = 8000;
export interface State extends GameStateBase {
  world: World;
  began: number;
  endsAt: number;
  round: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  settings: { rounds: number };
  phoneOnly?: true;
}
export type Transition = (state: State, now: number) => State;
