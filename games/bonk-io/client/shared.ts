import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'bonk-io',
  strings: STRINGS,
  sounds: { ready: 'ready', play: 'silence', score: 'reveal', done: 'reveal' },
};
