// The shell supplies original sound cues at each round reveal and at the finish.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'word-guess-race',
  strings: STRINGS,
  sounds: { reveal: 'reveal', done: 'tally' },
};
