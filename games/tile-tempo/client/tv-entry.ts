// The race owns its roster and clock, keeping the shell from displaying them twice.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = { ...shared, stripOff: true, quietTimer: true, Tv };
