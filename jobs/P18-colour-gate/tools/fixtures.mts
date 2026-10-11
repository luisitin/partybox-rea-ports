// Every snapshot comes from one real eight-player seeded bot match; done continues score-last.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { game } from '../../../games/colour-gate/server/index.ts';
import type { State } from '../../../games/colour-gate/server/types.ts';
import { beat, start } from './sim.mts';

const output = new URL('../../../games/colour-gate/fixtures/', import.meta.url);
mkdirSync(output, { recursive: true });
const save = (name: string, s: State) =>
  writeFileSync(new URL(`${name}.json`, output), `${JSON.stringify(s, null, 2)}\n`, 'utf8');
const rng = createRng(18);
let state = start(8, 18);
let savedPlay = false,
  savedScore = false;
for (let i = 0; state.phase.id !== 'done'; i++) {
  if (i > 4000) throw new Error('Fixture match stalled');
  state = beat(state, rng);
  if (!savedPlay && state.phase.id === 'play' && state.world.checked >= 12_000) {
    save('play', state);
    savedPlay = true;
  }
  if (state.phase.id === 'score') {
    if (!savedScore) {
      save('score', state);
      savedScore = true;
    }
    if (state.round === state.settings.rounds) save('score-last', state);
  }
}
save('done', state);
if (!savedPlay || !savedScore || !game.results(state)) throw new Error('Missing fixture phase');
console.log('Wrote play, score, score-last and done from seeded eight-player play.');
process.exit(0);
