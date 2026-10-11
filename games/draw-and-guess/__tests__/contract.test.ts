import { listGameIds, shardIds } from '../../../packages/game-sdk/src/contract-tests/load';

// The SDK suite discovers every game. Restrict it before importing the suite so
// this game's targeted command never consumes CPU simulating another runner's game.
const ids = listGameIds();
const shard = ids.findIndex((_, index) =>
  shardIds(ids, `${index + 1}/${ids.length}`).includes('draw-and-guess'),
);
if (shard < 0) throw new Error('Draw and Guess was not discovered by the SDK contract loader');
const previous = process.env['PB_CONTRACT_SHARD'];
process.env['PB_CONTRACT_SHARD'] = `${shard + 1}/${ids.length}`;
try {
  await import('../../../packages/game-sdk/src/contract-tests/contract.test');
} finally {
  if (previous === undefined) delete process.env['PB_CONTRACT_SHARD'];
  else process.env['PB_CONTRACT_SHARD'] = previous;
}
