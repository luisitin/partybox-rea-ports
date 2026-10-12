import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'haxball',
  strings: STRINGS,
  sounds: { play: 'silence', goal: 'reveal', halftime: 'phase', done: 'reveal' },
};
