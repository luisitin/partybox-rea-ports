// Run the real SDK suite against exactly this game; never fan out other ports.
import { listGameIds, shardIds } from '../../../packages/game-sdk/src/contract-tests/load';

const ids = listGameIds();
const count = ids.length;
const shard = Array.from({ length: count }, (_, i) => `${i + 1}/${count}`).find(
  (spec) => JSON.stringify(shardIds(ids, spec)) === '["haxball"]',
);
if (!shard) throw new Error('Could not isolate the Haxball SDK contract shard');
const previous = process.env['PB_CONTRACT_SHARD'];
process.env['PB_CONTRACT_SHARD'] = shard;
try {
  await import('../../../packages/game-sdk/src/contract-tests/contract.test');
} finally {
  if (previous === undefined) delete process.env['PB_CONTRACT_SHARD'];
  else process.env['PB_CONTRACT_SHARD'] = previous;
}
