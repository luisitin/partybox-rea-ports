// The TV entry (ADR-050): the registry downloads it on the TV once the game is chosen, never on a
// phone.
import type { GameTvModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = { ...shared, Tv };
