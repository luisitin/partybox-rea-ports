import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'merge-sprint',
  strings: STRINGS,
  sounds: { reveal: 'reveal', done: 'silence' },
};
