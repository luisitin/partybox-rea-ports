// The phone entry (ADR-050): the registry downloads it once the game is chosen, never on the TV.
import type { GamePhoneModule } from '@partybox/game-sdk/ui';
import { Controller } from './Controller';
import { shared } from './shared';

export const phone: GamePhoneModule = { ...shared, Controller };
