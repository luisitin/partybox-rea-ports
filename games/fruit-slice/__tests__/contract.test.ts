// Run the actual SDK suite while discovering only our game, including under the job's CI command.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return { ...original, listGameIds: () => ['fruit-slice'] };
});

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
