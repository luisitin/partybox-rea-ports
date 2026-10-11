// State types for Curve Fever. The round's board is `world` (server/world.ts); this file is the match around it. JSON only.
import type { GameStateBase } from '@partybox/game-sdk';
import type { World } from './world';

export const PHASES = ['ready', 'play', 'score', 'done'] as const;
export type PhaseId = (typeof PHASES)[number];

/** The worms wait this long (ms) before they are let go, and the standings stay up this long between rounds. */
export const READY_MS = 3000;
export const SCORE_MS = 4500;

export interface State extends GameStateBase {
  /** Server time the worms were let go and the time the round is called; a pause moves both. Every time in `world` counts from `began`. */
  began: number;
  endsAt: number;
  world: World;
  /** Everything up to here (ms after `began`) has been judged. */
  checked: number;
  /** The round on stage (1-based). */
  round: number;
  /** Match points so far, and what the round just played gave each player. */
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  settings: { rounds: number };
  /** The room had no TV when the match started (`ctx.presence.phoneOnly`): every phone is sent the arena (the phone is the stage). */
  phoneOnly?: true;
}

/** "Leave the current phase now": injected into phase reducers by server/index.ts (`advance`). */
export type Transition = (state: State, now: number) => State;
