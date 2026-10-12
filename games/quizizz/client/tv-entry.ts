// The TV downloads only its race stage.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = { ...shared, stripOff: true, quietTimer: true, Tv };
