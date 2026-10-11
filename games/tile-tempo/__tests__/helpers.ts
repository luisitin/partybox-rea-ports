// Event helpers keep rule tests explicit about server time and the row they acknowledge.
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

export const kit = testKit(game, { t0: 1_000_000, players: testPlayers(3) });
export const startPlay = (): State => kit.timer(kit.start());
export const tap = (state: State, id = 'p1', now = state.began + 100): State => {
  const row = state.runs[id]?.tiles ?? 0;
  const column = state.sequence[row] ?? 0;
  return kit.input(state, id, { type: 'tap', column, row }, now);
};
export const miss = (state: State, id = 'p1', now = state.began + 200): State => {
  const row = state.runs[id]?.tiles ?? 0;
  const column = ((state.sequence[row] ?? 0) + 1) % 4;
  return kit.input(state, id, { type: 'tap', column, row }, now);
};

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const unsafeTap = (column: unknown, row: unknown): Input =>
  ({ type: 'tap', column, row }) as Input;
