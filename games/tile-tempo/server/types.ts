// JSON state and wire inputs for the shared thirty-second note race.
import { z } from '@partybox/game-sdk';
import type { BotSkill, GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['ready', 'play', 'score', 'done'] as const;
export const READY_MS = 3000;
export const PLAY_MS = 30_000;
export const SCORE_MS = 6000;
export const TICK_MS = 100;
export const inputSchema = z.object({
  type: z.literal('tap'),
  column: z.number().int().min(0).max(3),
  row: z.number().int().nonnegative(),
});
export type Input = z.infer<typeof inputSchema>;
export interface Run {
  tiles: number;
  out: boolean;
  wrongColumn: number | null;
  lastAt: number | null;
}
export interface State extends GameStateBase {
  sequence: number[];
  runs: Record<string, Run>;
  began: number;
  endsAt: number;
  elapsed: number;
  phoneOnly: boolean;
  botSkill: BotSkill;
}
export type Transition = (state: State, now: number) => State;
