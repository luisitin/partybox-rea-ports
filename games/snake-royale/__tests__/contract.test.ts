// Run the real SDK contract suite through this game's targeted test command only.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return {
    ...actual,
    listGameIds: () => ['snake-royale'],
    shardIds: (ids: readonly string[]) => [...ids],
  };
});

import '../../../packages/game-sdk/src/contract-tests/contract.test';
