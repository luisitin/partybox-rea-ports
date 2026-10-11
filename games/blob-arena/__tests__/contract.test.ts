// Import the real SDK suite, restricted to this game even if other ports land concurrently.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (original) => {
  const actual =
    await original<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return { ...actual, listGameIds: () => ['blob-arena'], shardIds: () => ['blob-arena'] };
});

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
