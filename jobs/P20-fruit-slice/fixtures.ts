// Tool-only I/O: regenerate real eight-seat state snapshots through public events.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/fruit-slice/server/index';

const directory = new URL('../../games/fruit-slice/fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
let state = game.init({ players: testPlayers(8), settings: {}, seed: 19, now: 1_000_000 });
const rng = createRng(19);
for (let t = 200; t <= 60_000; t += 200) {
  state = game.reduce(state, {
    type: 'timer',
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
    now: state.began + t,
  });
  if (state.phase.id === 'play' && t % 2000 === 1000) {
    for (const [i, id] of Object.keys(state.players).entries()) {
      const input = game.bot.sampleInput(state, id, rng, i % 3 === 0 ? 'easy' : 'sharp');
      if (input)
        state = game.reduce(state, { type: 'input', playerId: id, input, now: state.began + t });
    }
  }
  if (t === 3000)
    writeFileSync(new URL('play.json', directory), JSON.stringify(state, null, 2) + '\n');
}
writeFileSync(new URL('score.json', directory), JSON.stringify(state, null, 2) + '\n');
state = game.reduce(state, {
  type: 'timer',
  phaseId: state.phase.id,
  startedAt: state.phase.startedAt,
  now: state.phase.deadline!,
});
writeFileSync(new URL('done.json', directory), JSON.stringify(state, null, 2) + '\n');
