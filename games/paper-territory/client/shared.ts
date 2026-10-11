// Both devices share phase cues and copy; moving and trail cutting remain server-owned.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'paper-territory',
  strings: STRINGS,
  sounds: { ready: 'phase', play: 'start', score: 'tally', done: 'reveal' },
  beds: { ready: 'bossa', play: 'pulse', score: 'lounge' },
};
