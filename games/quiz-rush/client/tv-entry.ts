import type { GameTvModule } from '@partybox/game-sdk/ui';
import { Tv } from './Tv';
import { shared } from './shared';

export const tv: GameTvModule = {
  ...shared,
  Tv,
  quietTimer: true,
  quickInto: ['question', 'reveal', 'podium'],
  stripScores: (view) => view.phaseId !== 'podium',
};
