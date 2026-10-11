// Run the unmodified SDK suite for this game alone, keeping desktop CPU bounded.
import { listGameIds } from '@partybox/game-sdk/testing';

const ids = listGameIds();
const heavy = ['chess', 'yahtzee', 'monopoly'];
const order = [
  ...heavy.filter((id) => ids.includes(id)),
  ...ids.filter((id) => !heavy.includes(id)),
];
const previous = process.env['PB_CONTRACT_SHARD'];
process.env['PB_CONTRACT_SHARD'] = `${order.indexOf('colour-gate') + 1}/${ids.length}`;
try {
  await import('../../../packages/game-sdk/src/contract-tests/contract.test');
} finally {
  if (previous === undefined) delete process.env['PB_CONTRACT_SHARD'];
  else process.env['PB_CONTRACT_SHARD'] = previous;
}
