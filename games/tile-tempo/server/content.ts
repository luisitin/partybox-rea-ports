// Generate the shared note track once, keeping every player's race on the same sequence.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';

export function makeSequence(rng: RngState): [number[], RngState] {
  const sequence: number[] = [];
  let nextRng = rng;
  for (let row = 0; row < 1024; row++) {
    let column: number;
    [column, nextRng] = nextInt(nextRng, 0, 3);
    sequence.push(column);
  }
  return [sequence, nextRng];
}
