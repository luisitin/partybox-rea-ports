import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'snake-royale',
  strings: STRINGS,
  sounds: { play: 'phase', score: 'reveal', done: 'reveal' },
};
