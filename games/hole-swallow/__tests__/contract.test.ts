// Execute the SDK's actual contract suite inside the own-game test command.
// Discovery is narrowed locally; shared files and other games are untouched.
import { vi } from 'vitest';

vi.mock('../../../packages/game-sdk/src/contract-tests/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../packages/game-sdk/src/contract-tests/load')>()),
  listGameIds: () => ['hole-swallow'],
  // This wrapper always runs the entire contract for its one game, even in a sharded shell.
  shardIds: (ids: readonly string[]) => [...ids],
}));

await import('../../../packages/game-sdk/src/contract-tests/contract.test');
