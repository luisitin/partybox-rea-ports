import { listGameIds, shardIds } from '../../../packages/game-sdk/src/contract-tests/load';

// Limit the shared SDK suite to this game before it discovers definitions. This
// game's targeted test command must never simulate another runner's game.
const ids = listGameIds();
const shard = ids.findIndex((_, index) =>
  shardIds(ids, `${index + 1}/${ids.length}`).includes('paper-territory'),
);
if (shard < 0) throw new Error('Paper Territory was not discovered by the SDK contract loader');
const previous = process.env['PB_CONTRACT_SHARD'];
process.env['PB_CONTRACT_SHARD'] = `${shard + 1}/${ids.length}`;
try {
  await import('../../../packages/game-sdk/src/contract-tests/contract.test');
} finally {
  if (previous === undefined) delete process.env['PB_CONTRACT_SHARD'];
  else process.env['PB_CONTRACT_SHARD'] = previous;
}
