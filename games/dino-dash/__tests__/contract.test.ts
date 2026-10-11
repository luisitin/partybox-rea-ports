// Run the actual SDK contract, isolated to this game even as the public queue grows.
import { describe, expect, it } from 'vitest';
import { listGameIds, shardIds } from '../../../packages/game-sdk/src/contract-tests/load';

const ids = listGameIds();
const count = ids.length;
const spec = Array.from({ length: count }, (_, i) => `${i + 1}/${count}`).find(
  (shard) => shardIds(ids, shard).join(',') === 'dino-dash',
);
if (!spec) throw new Error('Cannot isolate dino-dash in the SDK contract shard');
const prior = process.env['PB_CONTRACT_SHARD'];
process.env['PB_CONTRACT_SHARD'] = spec;
try {
  await import('../../../packages/game-sdk/src/contract-tests/contract.test');
} finally {
  if (prior === undefined) delete process.env['PB_CONTRACT_SHARD'];
  else process.env['PB_CONTRACT_SHARD'] = prior;
}
describe('local SDK contract selection', () => {
  it('selected exactly Dino Dash', () => expect(shardIds(ids, spec)).toEqual(['dino-dash']));
});
