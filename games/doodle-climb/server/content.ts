// Original procedural content; every player receives the same reachable route.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { BOUNCE, W } from './types';
import type { Platform, World } from './types';

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  const platforms: Platform[] = [{ id: 0, x: W / 2, y: 0, width: W, kind: 'normal' }];
  let r = rng;
  let x = W / 2;
  let y = 0;
  for (let id = 1; id <= 260; id++) {
    let gap: number, offset: number, spring: number;
    [gap, r] = nextInt(r, 45, 64);
    [offset, r] = nextInt(r, -65, 65);
    [spring, r] = nextInt(r, 0, 8);
    x = (((x + offset) % W) + W) % W;
    y += gap;
    platforms.push({
      id,
      x,
      y,
      width: Math.max(44, 76 - Math.floor(y / 150)),
      kind: spring === 0 ? 'spring' : 'normal',
    });
  }
  return [
    {
      platforms,
      climbers: ids.map((id) => ({
        id,
        x: W / 2,
        y: 0,
        vy: BOUNCE,
        dir: 0,
        peak: 0,
        camera: 0,
        died: null,
        bounces: 0,
      })),
      stepped: 0,
    },
    r,
  ];
}
