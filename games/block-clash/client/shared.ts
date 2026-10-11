import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';
export const shared: GameShared = {
  id: 'block-clash',
  strings: STRINGS,
  sounds: { play: 'silence', score: 'reveal', done: 'win' },
};
