// Import the actual SDK contract suite while keeping the runner scoped to this game.
import { vi } from 'vitest';

// Many desktop runners share the CPU; this changes only real execution time.
// The SDK's 5000-event ceiling and all simulated-time budgets remain intact.
vi.setConfig({ testTimeout: 120_000 });

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>();
  return { ...original, listGameIds: () => ['doodle-climb'] };
});

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
