// State and input types for Quick Poll. Keep everything JSON-serializable (docs/GAME_CONTRACT.md).
import { z } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['answer', 'reveal', 'done'] as const;
export type PhaseId = (typeof PHASES)[number];

export interface State extends GameStateBase {
  prompt: string;
  /** playerId → trimmed answer, only for players who submitted. */
  answers: Record<string, string>;
  scores: Record<string, number>;
  settings: { answerSeconds: number };
}

export const inputSchema = z.object({
  type: z.literal('answer'),
  text: z.string().min(1).max(24),
});
export type Input = z.infer<typeof inputSchema>;

export const REVEAL_MS = 8_000;

/** "Leave the current phase now" — injected into phase reducers by server/index.ts (`advance`). */
export type Transition = (state: State, now: number) => State;
