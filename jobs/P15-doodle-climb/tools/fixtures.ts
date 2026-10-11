import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { game } from '../../../games/doodle-climb/server/index';
import type { State } from '../../../games/doodle-climb/server/types';
import { simulate } from './simulation';

const states: Record<string, State> = {};
simulate(8, 15, (state) => {
  if (state.phase.id === 'play' && state.elapsed >= 2000 && !states.play) states.play = state;
  if (state.phase.id === 'score' && state.round === 1 && !states.score) states.score = state;
  if (state.phase.id === 'ready' && !states.ready) states.ready = state;
  if (state.phase.id === 'score' && state.round === state.settings.rounds)
    states['score-last'] = state;
});
const last = states['score-last'];
if (!last || last.phase.deadline === null) throw new Error('no final score fixture');
states.done = game.reduce(last, {
  type: 'timer',
  now: last.phase.deadline,
  phaseId: last.phase.id,
  startedAt: last.phase.startedAt,
});
if (states.done.phase.id !== 'done') throw new Error('score-last fixture did not continue to done');
const dir = fileURLToPath(new URL('../../../games/doodle-climb/fixtures/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const [name, state] of Object.entries(states)) {
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log(
    `${name}: ${state.phase.id}, round ${state.round}, ${Object.keys(state.players).length} players`,
  );
}
