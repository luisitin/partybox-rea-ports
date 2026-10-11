// ADR-088: how a board game reaches its minigames. The list of games is sealed in @partybox/shared
// (the server fills it at boot and may not import the SDK); a game reads it here. On the client the
// shell hands over its loader once, so a board mounts a minigame's own TV and phone screens.
import type { GamePhoneModule, GameTvModule } from '../client-module';

export { registerMinigames, registeredMinigames } from '@partybox/shared';

/** The client's way to download a game's screen (the shell's loader with its retries). */
export type MinigameModuleLoader = {
  (id: string, surface: 'tv'): Promise<GameTvModule | null>;
  (id: string, surface: 'phone'): Promise<GamePhoneModule | null>;
};

let loader: MinigameModuleLoader | null = null;

/** The client entry hands over its loader once; later calls are ignored. */
export function registerMinigameLoader(load: MinigameModuleLoader): boolean {
  if (loader) return false;
  loader = load;
  return true;
}

export const minigameLoader = (): MinigameModuleLoader | null => loader;

/** Tests only: forget the loader. */
export function resetMinigameLoaderForTests(): void {
  loader = null;
}
