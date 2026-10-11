import type { GamePhoneModule } from '@partybox/game-sdk/ui';
import { shared } from './shared';
import { Controller } from './Controller';

export const phone: GamePhoneModule = { ...shared, Controller };
