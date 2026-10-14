// Run the real SDK contract under the game's scoped test command. Only discovery is
// narrowed; all SDK checks, loaders, fixtures, fuzzing and simulation stay intact.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return { ...actual, listGameIds: () => ['skribbl'], shardIds: () => ['skribbl'] };
});

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
