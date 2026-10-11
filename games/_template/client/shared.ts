// What the phone and TV entries both carry (ADR-050): the sound plan and the words.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'template',
  strings: STRINGS,
  sounds: { reveal: 'reveal' },
};
