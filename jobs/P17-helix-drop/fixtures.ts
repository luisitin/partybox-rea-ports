// Regenerate deterministic eight-player examples; done continues the reveal fixture.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/helix-drop/server/index';
import type { State } from '../../games/helix-drop/server/types';

mkdirSync('games/helix-drop/fixtures', { recursive: true });
const rng = createRng(912);
let state = game.init({ players: testPlayers(8), settings: {}, seed: 912, now: 1_700_000_000_000 });
const save = (name: string, s: State): void =>
  writeFileSync(`games/helix-drop/fixtures/${name}.json`, JSON.stringify(s, null, 2) + '\n');
save('play-start', state);
while (state.phase.id === 'play') {
  const now = state.phase.deadline!;
  for (const p of Object.values(state.players)) {
    const input = game.bot.sampleInput(state, p.id, rng, 'normal');
    if (input) state = game.reduce(state, { type: 'input', now: now - 1, playerId: p.id, input });
  }
  state = game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  if (state.checked === 8000 && state.phase.id === 'play') save('play', state);
}
save('reveal', state);
state = game.reduce(state, {
  type: 'timer',
  now: state.phase.deadline!,
  phaseId: state.phase.id,
  startedAt: state.phase.startedAt,
});
save('done', state);
console.log('Generated play-start, play, reveal and continuous done fixtures.');
