// Sound and language data travel in both surface bundles; neither surface imports the other.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'tile-tempo',
  strings: STRINGS,
  sounds: { ready: 'ready', play: 'phase', score: 'reveal', done: 'reveal' },
  beds: { play: 'marimba' },
};
