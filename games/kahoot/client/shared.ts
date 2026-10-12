// What Lightning Round's phone and TV entries both carry (ADR-050): the sound plan and the words.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'kahoot',
  strings: STRINGS,
  sounds: { reveal: 'reveal', wager: 'wager' },
  // Licensed core file music is excluded from this asset-free public draft.
};
