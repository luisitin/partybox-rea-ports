// Rebuild phase fixtures from one real, eight-seat seeded match.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/block-clash/server/index';
import { enterScore } from '../../../games/block-clash/server/phases/score';
import type { State } from '../../../games/block-clash/server/types';

const folder = 'games/block-clash/fixtures';
mkdirSync(folder, { recursive: true });
const save = (name: string, state: State): void =>
  writeFileSync(`${folder}/${name}.json`, JSON.stringify(state, null, 2) + '\n');
const rng = createRng(11);
let state = game.init({
  players: testPlayers(8, { bots: 8 }),
  seed: 11,
  now: 1_000_000,
  settings: {},
  botSkill: 'sharp',
});
let play = state;
for (let beat = 0; beat < 1000 && state.phase.id === 'play'; beat++) {
  const now = state.phase.deadline! - 1;
  for (const board of state.boards) {
    const input = game.bot.sampleInput(state, board.id, rng, 'sharp');
    if (input) state = game.reduce(state, { type: 'input', now, playerId: board.id, input });
  }
  if (state.checked - state.began <= 8000) play = state;
  if (state.phase.id === 'play')
    state = game.reduce(state, {
      type: 'timer',
      now: state.phase.deadline!,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
}
save('play', play);
if (state.phase.id !== 'score') state = enterScore(state, state.checked);
save('score', state);
const done = game.reduce(state, {
  type: 'timer',
  now: state.phase.deadline!,
  phaseId: state.phase.id,
  startedAt: state.phase.startedAt,
});
save('done', done);
console.log(
  JSON.stringify({
    playAt: play.checked - play.began,
    phases: [play.phase.id, state.phase.id, done.phase.id],
    alive: play.boards.filter((b) => b.alive).length,
  }),
);
