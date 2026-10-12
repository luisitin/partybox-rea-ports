// What Lightning Round's phone and TV entries both carry (ADR-050): the sound plan and the words.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'kahoot',
  strings: STRINGS,
  sounds: { reveal: 'reveal', wager: 'wager', podium: 'silence', done: 'win' },
  // Public fallback uses the SDK's synthesized beds; no licensed host file is downloaded.
  beds: {
    talk: 'warm',
    question: 'pulse',
    reveal: 'latenight',
    wager: 'warm',
    podium: 'latenight',
  },
  // Licensed core file music is excluded from this asset-free public draft.
};
