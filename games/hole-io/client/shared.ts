// Modest SDK-synthesized sound plan; no samples, files or runtime network access.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'hole-io',
  strings: STRINGS,
  sounds: { play: 'silence', reveal: 'reveal', done: 'tally' },
  beds: { play: 'marimba', reveal: 'latenight' },
};
