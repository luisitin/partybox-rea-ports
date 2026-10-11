// Invoke the real SDK suite through this game-scoped test path. One shard per game
// guarantees that pnpm vitest run games/block-clash never simulates another game.
import { listGameIds, shardIds } from '../../../packages/game-sdk/src/contract-tests/load';
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const ids = listGameIds();
const shard = Array.from({ length: ids.length }, (_, index) => `${index + 1}/${ids.length}`).find(
  (spec) => shardIds(ids, spec).includes('block-clash'),
);
if (!shard) throw new Error('block-clash has no contract shard');
process.env['PB_CONTRACT_SHARD'] = shard;
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
