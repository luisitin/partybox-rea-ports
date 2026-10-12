// Seeded spark food; no external content or asset packs.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { H, W } from './types';
import type { Food } from './types';

export function spark(rng: RngState): [Food, RngState] {
  const [x, r1] = nextInt(rng, 8, W - 8);
  const [y, r2] = nextInt(r1, 8, H - 8);
  return [{ x, y, value: 1 }, r2];
}
