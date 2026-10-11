// The game owns the race stage and its large clock.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { Tv } from './Tv';
import { shared } from './shared';

export const tv: GameTvModule = { ...shared, Tv, stripOff: true, quietTimer: true };
