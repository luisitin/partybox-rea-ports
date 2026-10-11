import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import { finishGame, makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/crossy-streets/server/index';
import type { State } from '../../games/crossy-streets/server/types';

const fixtures = resolve('games/crossy-streets/fixtures');
mkdirSync(fixtures, { recursive: true });
const rng = createRng(14);
let state: State = game.init({ players: makePlayers(8), settings: {}, seed: 14, now: 1_000_000 });
let captured = false;
while (state.phase.id === 'play') {
  const now = state.phase.deadline!;
  state = game.reduce(state, {
    type: 'timer',
    now,
    phaseId: 'play',
    startedAt: state.phase.startedAt,
  });
  if (state.phase.id === 'play') {
    for (const id of Object.keys(state.players)) {
      const input = game.bot.sampleInput(state, id, rng, 'sharp');
      if (input) state = game.reduce(state, { type: 'input', now, playerId: id, input });
    }
    if (!captured && state.checked >= 15_000) {
      writeFileSync(resolve(fixtures, 'play.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');
      captured = true;
    }
  }
}
if (!captured || state.phase.id !== 'score') throw new Error('expected one play-to-score round');
writeFileSync(resolve(fixtures, 'score.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');
const done = finishGame(game, state, 2000);
if (!done || done.phase.id !== 'done') throw new Error('score fixture did not finish');
writeFileSync(resolve(fixtures, 'done.json'), JSON.stringify(done, null, 2) + '\n', 'utf8');
console.log(
  'Generated play, score, done fixtures from seed 14, eight sharp bots; score → done is exact.',
);
