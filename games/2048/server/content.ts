// Generate shared spawn luck once from state.rng; never expose future draws.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { MAX_MOVES } from './types';
import type { Spawn } from './types';

export function spawnStream(rng: RngState): [Spawn[], RngState] {
  let current = rng;
  const draws: Spawn[] = [];
  for (let i = 0; i < MAX_MOVES + 2; i++) {
    let slot: number, chance: number;
    [slot, current] = nextInt(current, 0, 65535);
    [chance, current] = nextInt(current, 0, 9);
    draws.push({ slot, value: chance === 9 ? 4 : 2 });
  }
  return [draws, current];
}
