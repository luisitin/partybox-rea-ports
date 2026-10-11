import type { GameTvModule } from '@partybox/game-sdk/ui';
import { Tv } from './Tv';
import { shared } from './shared';
export const tv: GameTvModule = { ...shared, stripOff: true, quietTimer: true, Tv };
