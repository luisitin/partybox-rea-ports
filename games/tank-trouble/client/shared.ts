// Sound and words travel in both small surface entries; artwork is original SVG, with no asset downloads.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'tank-trouble',
  strings: STRINGS,
  sounds: { ready: 'countdown', play: 'start', score: 'tally', done: 'reveal' },
  beds: { play: 'pulse', score: 'warm' },
};
