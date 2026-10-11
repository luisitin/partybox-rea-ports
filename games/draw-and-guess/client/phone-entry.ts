// Downloaded by phones once Draw and Guess is selected.
import type { GamePhoneModule } from '@partybox/game-sdk/ui';
import { Controller } from './Controller';
import { shared } from './shared';

export const phone: GamePhoneModule = { ...shared, Controller };
