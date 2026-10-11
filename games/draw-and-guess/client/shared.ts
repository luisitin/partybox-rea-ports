import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'draw-and-guess',
  strings: STRINGS,
  sounds: { choose: 'phase', draw: 'phase', reveal: 'reveal', done: 'reveal' },
};
