// Real fixture states from one seeded eight-player game, including terminal continuity.
import { writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/stack-tower/server/index';

const rng = createRng(16);
const players = testPlayers(8).map((p, i) => ({ ...p, canSeeTv: i !== 7 }));
let state = game.init({ players, settings: {}, seed: 16, now: 1000 });
const save = (name: string): void =>
  writeFileSync(
    new URL(`../../../games/stack-tower/fixtures/${name}.json`, import.meta.url),
    JSON.stringify(state, null, 2) + '\n',
  );
save('initial');
while (!game.results(state)) {
  const now = state.phase.deadline!;
  state = game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  for (let i = 0; i < players.length; i++) {
    const input = game.bot.sampleInput(
      state,
      players[i]!.id,
      rng,
      (['easy', 'normal', 'sharp'] as const)[i % 3],
    );
    if (input) state = game.reduce(state, { type: 'input', now, playerId: players[i]!.id, input });
  }
  if (now === 16_000) save('play');
  if (state.phase.id === 'score') save('score');
}
save('done');
console.log('Fixtures: initial, play, score, done from seed 16.');
