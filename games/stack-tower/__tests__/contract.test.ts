import { vi } from 'vitest';

// Reuse the real SDK contract suite while ensuring the game command never loads another port.
// Ignore a parent's sharding environment: this wrapper always checks precisely Skyline Stack.
vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return {
    ...original,
    listGameIds: () => ['stack-tower'],
    shardIds: (ids: readonly string[]) => [...ids],
  };
});

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
