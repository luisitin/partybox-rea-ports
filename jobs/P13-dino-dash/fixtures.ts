// Capture one seeded eight-player game; score-last and done are consecutive authoritative states.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { game } from '../../games/dino-dash/server/index';
import type { State } from '../../games/dino-dash/server/types';
import { simulateOne } from './simulation';

const states = new Map<string, State>();
simulateOne(8, 14, 'sharp', (state) => {
  if (
    state.phase.id === 'play' &&
    state.round === 1 &&
    state.world.checked >= 2300 &&
    !states.has('play')
  )
    states.set('play', state);
  if (state.phase.id === 'score' && state.round === 1 && !states.has('score'))
    states.set('score', state);
  if (state.phase.id === 'score' && state.round === 3) states.set('score-last', state);
  if (state.phase.id === 'done') states.set('done', state);
});
const last = states.get('score-last');
const done = states.get('done');
if (!last || !done || !states.get('play') || !states.get('score'))
  throw new Error('Missing required fixture state');
const next = game.reduce(last, {
  type: 'timer',
  now: last.phase.deadline!,
  phaseId: last.phase.id,
  startedAt: last.phase.startedAt,
});
if (JSON.stringify(game.results(next)) !== JSON.stringify(game.results(done)))
  throw new Error('Fixture result continuity failed');
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../games/dino-dash/fixtures');
mkdirSync(fixtures, { recursive: true });
for (const [name, state] of states)
  writeFileSync(join(fixtures, `${name}.json`), JSON.stringify(state, null, 2) + '\n', 'utf8');
console.log(
  `Generated ${states.size} connected eight-player fixtures from seed 14, default settings.`,
);
