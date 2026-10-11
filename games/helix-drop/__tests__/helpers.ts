import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

export const kit = testKit(game, {
  t0: 1000,
  players: [
    { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  ],
  settings: { lives: 3 },
});

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value)) freeze(v);
  }
  return value;
}
