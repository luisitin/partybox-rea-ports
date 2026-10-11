// Both entry points share the game's words and its choice-to-reveal sound plan.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'draw-and-guess',
  strings: STRINGS,
  sounds: { choose: 'phase', draw: 'start', reveal: 'reveal', done: 'tally' },
  beds: { choose: 'bossa', draw: 'marimba', reveal: 'lounge' },
};
