// Shared sound plan, with the SDK's original synthesised cues.
import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';
export const shared: GameShared = {
  id: 'crossy-streets',
  strings: STRINGS,
  sounds: { play: 'phase', score: 'reveal', done: 'win' },
  beds: { play: 'marimba', score: 'warm' },
};
