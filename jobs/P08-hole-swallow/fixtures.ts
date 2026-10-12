// pnpm tsx jobs/P08-hole-swallow/fixtures.ts
// The reveal and done snapshots continue the same played city, including every score.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { game } from '../../games/hole-io/server/index';
import { driveTo, initial } from './simulate';

const dir = new URL('../../games/hole-io/fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const rng = createRng(8);
const play = driveTo(initial(8, 8), 60_000, rng, 'normal');
const reveal = driveTo(play, 90_000, rng, 'normal');
const done = game.reduce(reveal, {
  type: 'timer',
  now: reveal.phase.deadline!,
  phaseId: reveal.phase.id,
  startedAt: reveal.phase.startedAt,
});
for (const state of [play, reveal, done]) {
  writeFileSync(
    new URL(`${state.phase.id}.json`, dir),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}
process.stdout.write('Wrote eight-player play, reveal and done fixtures from one seeded game.\n');
