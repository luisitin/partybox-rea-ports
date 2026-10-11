import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import type { Obstacle, Runner, World } from '../server/world';

export const T0 = 1_000_000;
export const kit = testKit(game, {
  t0: T0,
  players: testPlayers(3),
  settings: { rounds: 2 },
});
export const runner = (id: string, extra: Partial<Runner> = {}): Runner => ({
  id,
  jumpAt: null,
  duck: false,
  died: null,
  distance: 0,
  changes: 0,
  ...extra,
});
export const world = (runners: Runner[], course: Obstacle[] = []): World => ({
  runners,
  course,
  checked: 0,
  cursor: 0,
});
export const obstacle = (kind: 'rock' | 'bird', x = 440): Obstacle => ({
  id: 0,
  kind,
  x,
  width: 30,
  bottom: kind === 'bird' ? 32 : 0,
  height: kind === 'bird' ? 34 : 45,
});
export const safe = (s: State = kit.start()): State => ({
  ...s,
  world: { ...s.world, course: [] },
});
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
