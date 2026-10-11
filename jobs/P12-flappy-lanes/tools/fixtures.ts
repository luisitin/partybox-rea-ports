// Regenerate real four/eight-seat preview states from the same match, including the final reveal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { game } from '../../../games/flappy-lanes/server/index';
import type { State } from '../../../games/flappy-lanes/server/types';

const dir = 'games/flappy-lanes/fixtures';
mkdirSync(dir, { recursive: true });
const save = (name: string, state: State): void =>
  writeFileSync(`${dir}/${name}.json`, `${JSON.stringify(state, null, 2)}\n`);
const players = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: ['Ada', 'Bea', 'Cam', 'Dev', 'Eli', 'Flo', 'Gia', 'Hal'][i]!,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const rng = createRng(41);
let s = game.init({ players, settings: {}, seed: 41, now: 1_700_000_000_000 });
let savedPlay = false;
let savedScore = false;
for (let steps = 0; steps < 10_000 && s.phase.id !== 'done'; steps++) {
  if (s.phase.id === 'play') {
    const prior = s;
    const now = s.phase.deadline!;
    const decisions = players.map((p, i) => ({
      id: p.id,
      input: game.bot.sampleInput(prior, p.id, rng, i < 2 ? 'sharp' : i < 5 ? 'normal' : 'easy'),
    }));
    for (const { id, input } of decisions)
      if (input && s.phase.id === 'play')
        s = game.reduce(s, { type: 'input', now: now - 1, playerId: id, input });
    if (s.phase.id === 'play')
      s = game.reduce(s, { type: 'timer', now, phaseId: s.phase.id, startedAt: s.phase.startedAt });
    if (!savedPlay && s.phase.id === 'play' && s.world.checked >= 5000) {
      save('play', s);
      savedPlay = true;
    }
  } else {
    if (!savedScore) {
      save('score', s);
      savedScore = true;
    }
    if (s.round === s.settings.rounds) save('score-last', s);
    s = game.reduce(s, {
      type: 'timer',
      now: s.phase.deadline!,
      phaseId: s.phase.id,
      startedAt: s.phase.startedAt,
    });
  }
}
if (s.phase.id !== 'done' || !savedPlay || !savedScore)
  throw new Error('Fixture run did not cover every phase');
save('done', s);
console.log(`Fixtures: play, score, score-last, done; final ${JSON.stringify(s.scores)}`);
process.exit(0);
