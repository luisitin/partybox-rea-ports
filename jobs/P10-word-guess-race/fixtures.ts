import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { finishGame } from '@partybox/game-sdk/testing';
import { game } from '../../games/word-guess-race/server/index';
import type { State } from '../../games/word-guess-race/server/types';
import { simulate } from './simulation';

const fixtures = new Map<string, State>();
simulate(8, 73, 'normal', (state) => {
  const key = state.phase.id;
  if (!fixtures.has(key)) fixtures.set(key, structuredClone(state));
  if (key === 'guess' && state.round === 1) {
    const guesses = Object.values(state.entries).reduce((n, e) => n + e.guesses.length, 0);
    if (guesses > 0 && guesses <= 8) fixtures.set('guess', structuredClone(state));
  }
  if (key === 'reveal' && state.round === 3) fixtures.set('reveal-last', structuredClone(state));
});
const last = fixtures.get('reveal-last');
if (!last) throw new Error('Missing final reveal');
const done = finishGame(game, last) as State | null;
if (!done) throw new Error('Final reveal does not lead to done');
fixtures.set('done', done);
const folder = resolve('games/word-guess-race/fixtures');
mkdirSync(folder, { recursive: true });
for (const [name, state] of fixtures) {
  writeFileSync(resolve(folder, `${name}.json`), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  process.stdout.write(`${name}.json: round ${state.round}, phase ${state.phase.id}\n`);
}
