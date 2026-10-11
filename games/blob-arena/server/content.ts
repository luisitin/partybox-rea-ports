// Original seeded snacks; no external content or runtime requests.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { H, W } from './types';
import type { Pellet } from './types';

export function makePellet(rng: RngState, id: number): [Pellet, RngState] {
  const [x, r1] = nextInt(rng, 40, (W - 4) * 10);
  const [y, r2] = nextInt(r1, 40, (H - 4) * 10);
  return [{ id, x: x / 10, y: y / 10 }, r2];
}
