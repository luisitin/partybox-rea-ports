// One sound plan and word table for the race's two surfaces.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'quizizz',
  strings: STRINGS,
  sounds: { race: 'phase', podium: 'reveal', done: 'reveal' },
  beds: { race: 'pulse', podium: 'warm' },
};
