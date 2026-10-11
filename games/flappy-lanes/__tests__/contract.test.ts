// Run the actual SDK contract suite, with discovery scoped to this job only.
// A scoped game test must never load or simulate the other runners' games.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (original) => ({
  ...(await original<object>()),
  listGameIds: () => ['flappy-lanes'],
}));

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
