import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'dino-dash',
  strings: STRINGS,
  sounds: { play: 'start', score: 'tally', done: 'reveal' },
};
