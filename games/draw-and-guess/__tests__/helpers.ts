import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State, Stroke } from '../server/types';

export const T0 = 1_000_000;
export const players = testPlayers(3);
export const kit = testKit(game, { t0: T0, players, settings: { rounds: 1, seconds: 60 } });

export function drawing(seed = 1): State {
  const start = kit.start({ seed });
  return kit.input(start, start.drawerId, { type: 'choose', index: 0 }, T0 + 1000);
}

export function chunk(seq = 0, id = 0, count = 2): Input {
  const stroke: Stroke = {
    seq,
    id,
    color: 0,
    size: 5,
    points: Array.from({ length: count }, (_, i): [number, number] => [100 + i, 100 + i]),
  };
  return { type: 'stroke', stroke };
}

export function guesserIds(state: State): string[] {
  return Object.keys(state.players).filter((id) => id !== state.drawerId);
}

export function leafStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(leafStrings);
  if (value && typeof value === 'object')
    return Object.entries(value)
      .filter(([key]) => key !== 'players')
      .flatMap(([, entry]) => leafStrings(entry));
  return [];
}

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) freeze(entry);
  }
  return value;
}
