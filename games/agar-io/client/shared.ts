import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'agar-io',
  strings: STRINGS,
  sounds: { play: 'phase', score: 'reveal', done: 'reveal' },
};
