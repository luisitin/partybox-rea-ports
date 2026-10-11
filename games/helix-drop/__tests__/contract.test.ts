// Exercise the actual SDK suite, loading only this game so runners do not test each other's work.
import { vi } from 'vitest';
vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return { ...actual, listGameIds: () => ['helix-drop'] };
});
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
