import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'colour-gate',
  strings: STRINGS,
  sounds: { play: 'start', score: 'reveal', done: 'win' },
};
