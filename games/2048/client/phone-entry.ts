import type { GamePhoneModule } from '@partybox/game-sdk/ui';
import { Controller } from './Controller';
import { shared } from './shared';

export const phone: GamePhoneModule & { ownSpectatorScreen: () => boolean } = {
  ...shared,
  Controller,
  ownSpectatorScreen: () => true,
};
