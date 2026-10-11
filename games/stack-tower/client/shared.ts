import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'stack-tower',
  strings: STRINGS,
  sounds: { score: 'reveal', done: 'silence' },
};
