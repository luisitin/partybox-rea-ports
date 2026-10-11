// Rebuild phase fixtures from one reproducible eight-seat match.
import { mkdirSync, writeFileSync } from 'node:fs';
import { game } from '../../games/blob-arena/server/index.ts';
import { createRng } from '@partybox/game-sdk';
const players = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'].map((name, i) => ({
  id: `p${i + 1}`,
  name,
  avatarId: 'fox',
  connected: true,
  canSeeTv: i !== 7,
}));
let state = game.init({ players, seed: 17, now: 1700000000000, settings: {} });
const rng = createRng(771);
const directory = new URL('../../games/blob-arena/fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
const save = (name, s) =>
  writeFileSync(new URL(`${name}.json`, directory), JSON.stringify(s, null, 2) + '\n');
let savedPlay = false;
while (state.phase.id !== 'done') {
  if (state.phase.id === 'play') {
    const now = state.phase.deadline;
    if (state.world.time % 1000 === 0) {
      for (const p of players) {
        const input = game.bot.sampleInput(state, p.id, rng, 'sharp');
        if (input)
          state = game.reduce(state, {
            type: 'input',
            now: state.began + state.world.time + 50,
            playerId: p.id,
            input,
          });
      }
    }
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    if (!savedPlay && state.world.time >= 12000) {
      save('play', state);
      savedPlay = true;
    }
  } else {
    save(state.round === 3 ? 'score-last' : 'score', state);
    state = game.reduce(state, {
      type: 'timer',
      now: state.phase.deadline,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
  }
}
save('done', state);
console.log('Generated play, score, score-last, done from seed17; scores:', state.scores);
