import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/pong-party/server/index';
import type { State } from '../../games/pong-party/server/types';

const rng = createRng(21);
const players = testPlayers(8);
let state = game.init({ players, settings: {}, seed: 21, now: 1_000_000 });
let play: State = state;
let now = state.began;
while (state.phase.id === 'play') {
  now = Math.min(state.endsAt, now + 400);
  state = game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  for (const player of players) {
    if (state.phase.id !== 'play') break;
    const input = game.bot.sampleInput(state, player.id, rng, 'sharp');
    if (input) state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
  }
  if (state.phase.id === 'play') {
    if (state.phase.id === 'play' && state.checked <= 30_000) play = state;
  }
}
if (state.phase.id !== 'score') throw new Error(`fixture score ended in ${state.phase.id}`);
const score = state;
const done = game.reduce(score, {
  type: 'timer',
  now: score.phase.deadline!,
  phaseId: score.phase.id,
  startedAt: score.phase.startedAt,
});
if (done.phase.id !== 'done') throw new Error('fixture did not finish');
const directory = resolve('games/pong-party/fixtures');
mkdirSync(directory, { recursive: true });
for (const [phase, fixture] of Object.entries({ play, score, done }))
  writeFileSync(
    resolve(directory, `${phase}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
    'utf8',
  );
console.log(`Fixtures: play at ${play.checked} ms, score at ${score.checked} ms, done from score.`);
