// JSON state and public progress: other players' letters never leave their controller.
import type { GameStateBase } from '@partybox/game-sdk';

export const PHASES = ['guess', 'reveal', 'done'] as const;
export const ROUNDS = 3;
export const MAX_GUESSES = 6;
export const REVEAL_MS = 9000;
export type Mark = 'correct' | 'present' | 'absent';

export interface Guess {
  word: string;
  marks: Mark[];
}

export interface Entry {
  guesses: Guess[];
  solvedElapsedMs: number | null;
  error: string | null;
  submissionVersion: number;
}

export interface PublicGrid {
  id: string;
  rows: Mark[][];
  solved: boolean;
  finished: boolean;
  elapsedMs: number | null;
}

export interface Input {
  type: 'guess';
  word: string;
  round: number;
}

export interface State extends GameStateBase {
  round: number;
  answers: string[];
  began: number;
  settings: { roundSeconds: number };
  entries: Record<string, Entry>;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  roundScored: boolean;
  phoneOnly?: true;
}

export type Transition = (state: State, now: number) => State;

export const emptyEntry = (): Entry => ({
  guesses: [],
  solvedElapsedMs: null,
  error: null,
  submissionVersion: 0,
});

export function finished(entry: Entry): boolean {
  return entry.solvedElapsedMs !== null || entry.guesses.length >= MAX_GUESSES;
}
