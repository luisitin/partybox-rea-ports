// Run the published contract suite unmodified while discovering only this game.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, listGameIds: () => ['ricochet-rumble'] };
});
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
