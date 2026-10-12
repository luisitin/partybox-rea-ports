// Run the real SDK contract suite through this game's targeted test command only.
import { vi } from 'vitest';

// The loaded desktop needs a wall-time allowance; SDK game-time/event/size limits stay intact.
vi.setConfig({ testTimeout: 120_000 });

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return {
    ...actual,
    listGameIds: () => ['slither-io'],
    shardIds: (ids: readonly string[]) => [...ids],
  };
});

import '../../../packages/game-sdk/src/contract-tests/contract.test';
