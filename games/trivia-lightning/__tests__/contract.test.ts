// Run the real SDK suite for this one game inside the owner's CPU-safe command.
import { listGameIds } from '../../../packages/game-sdk/src/contract-tests/load';
const ids = listGameIds();
process.env['PB_CONTRACT_SHARD'] = `${ids.indexOf('trivia-lightning') + 1}/${ids.length}`;
await import('../../../packages/game-sdk/src/contract-tests/contract.test');
