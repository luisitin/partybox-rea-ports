// Run the SDK's complete contract suite through the focused game's command, never all games.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (original) => ({
  ...(await original<typeof import('../../../packages/game-sdk/src/contract-tests/load')>()),
  listGameIds: () => ['tile-tempo'],
}));

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
