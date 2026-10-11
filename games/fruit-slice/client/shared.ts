import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'fruit-slice',
  strings: STRINGS,
  sounds: { play: 'silence', score: 'tally', done: 'reveal' },
};
