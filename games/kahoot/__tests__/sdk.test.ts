// Run the unmodified published SDK contract suite, discovering only our game in this worker.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, listGameIds: () => ['kahoot'] };
});
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
