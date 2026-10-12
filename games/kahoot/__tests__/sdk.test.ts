// Run the unmodified published SDK suite, discovering only this worker's game.
import { vi } from 'vitest';
vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return {
    ...actual,
    listGameIds: () => ['kahoot'],
    loadAllGames: async () => [await actual.loadGame('kahoot')],
  };
});
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
