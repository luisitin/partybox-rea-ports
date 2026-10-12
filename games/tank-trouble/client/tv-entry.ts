// One persistent arena avoids a phase transition covering the first live shots.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = {
  ...shared,
  Tv,
  keepMounted: true,
  stripOff: true,
  quietTimer: true,
};
