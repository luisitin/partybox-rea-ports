// Lightning Round's phone entry (ADR-050): downloaded once the game is chosen, never by the TV.
import type { GamePhoneModule } from '@partybox/game-sdk/ui';
import { Controller } from './Controller';
import { shared } from './shared';

export const phone: GamePhoneModule = { ...shared, Controller };
