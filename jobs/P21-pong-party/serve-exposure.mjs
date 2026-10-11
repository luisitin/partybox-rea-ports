// Geometry probe for deterministic serve distribution; run with pnpm exec tsx.
import { writeFileSync } from 'node:fs';
import { seedRng } from '@partybox/game-sdk';
import {
  CENTER,
  EDGES,
  firstCollision,
  makeWorld,
  SPEED,
} from '../../games/pong-party/server/world.ts';

const destination = (angle) =>
  firstCollision(
    {
      id: 0,
      x: CENTER,
      y: CENTER,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
      readyAt: 0,
    },
    10,
  ).edge.slot;

const result = {
  seeds: 1000,
  servesPerSeed: 32,
  legacySidesReached: { min: 8, max: 0 },
  rotatedSidesReached: { min: 8, max: 0 },
  worstRotatedSideCountSpread: 0,
  seed1: null,
};
for (let seed = 1; seed <= result.seeds; seed++) {
  const [world] = makeWorld(seedRng(seed), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const legacy = Array(8).fill(0);
  const rotated = Array(8).fill(0);
  let legacyAngle = world.spawnAngles[0];
  for (let rally = 0; rally < result.servesPerSeed; rally++) {
    const side = destination(legacyAngle);
    legacy[side]++;
    const edge = EDGES[side];
    // The previous implementation reset away from the missed edge with this ball's fixed angle.
    legacyAngle = Math.atan2(-edge.ny - edge.ty * 0.22, -edge.nx - edge.tx * 0.22);
    rotated[destination(world.spawnAngles[0] + rally * Math.PI * (3 - Math.sqrt(5)))]++;
  }
  for (const [counts, range] of [
    [legacy, result.legacySidesReached],
    [rotated, result.rotatedSidesReached],
  ]) {
    const reached = counts.filter(Boolean).length;
    range.min = Math.min(range.min, reached);
    range.max = Math.max(range.max, reached);
  }
  result.worstRotatedSideCountSpread = Math.max(
    result.worstRotatedSideCountSpread,
    Math.max(...rotated) - Math.min(...rotated),
  );
  if (seed === 1) result.seed1 = { legacy, rotated };
}
writeFileSync(
  new URL('./serve-exposure.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(result));
