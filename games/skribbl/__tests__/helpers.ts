import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State, Stroke } from '../server/types';

export const T0 = 1_000_000;
export const kit = testKit(game, {
  t0: T0,
  players: testPlayers(4),
  settings: { laps: 1, drawSeconds: 30, difficulty: 'easy' },
  inputAt: 1000,
});

export const stroke: Stroke = {
  points: [
    [100, 100],
    [300, 200],
  ],
  color: 2,
  width: 9,
};
export const guesser = (s: State): string => s.order.find((id) => id !== s.drawer) as string;
export const drawing = (): State => {
  const s = kit.start();
  return kit.input(s, s.drawer, { type: 'choose', index: 1 });
};

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

export const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));
