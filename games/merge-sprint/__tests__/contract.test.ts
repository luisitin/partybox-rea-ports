import { vi } from 'vitest';

// Run the actual SDK contract suite under the game's own path. Filtering discovery here means
// `pnpm vitest run games/merge-sprint` never simulates another runner's game.
vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>()),
  listGameIds: () => ['merge-sprint'],
}));

import '../../../packages/game-sdk/src/contract-tests/contract.test';
