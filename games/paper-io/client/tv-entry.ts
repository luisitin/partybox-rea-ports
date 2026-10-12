// The game draws its clock and eight-seat area rail beside the arena.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = { ...shared, quietTimer: true, stripOff: true, Tv };
