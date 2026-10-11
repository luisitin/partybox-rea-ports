// The two independently loaded surfaces share only words and the sound plan.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'doodle-climb',
  strings: STRINGS,
  sounds: { ready: 'countdown', score: 'reveal', done: 'reveal' },
};
