// Recreate phase fixtures from one eight-player match rather than hand-editing scores.
import { mkdirSync, writeFileSync } from 'node:fs';
import { makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/tile-tempo/server/index';
import type { State } from '../../../games/tile-tempo/server/types';

const dir = 'games/tile-tempo/fixtures';
mkdirSync(dir, { recursive: true });
function save(state: State): void {
  writeFileSync(`${dir}/${state.phase.id}.json`, `${JSON.stringify(state, null, 2)}\n`);
}
function timer(state: State): State {
  return game.reduce(state, {
    type: 'timer',
    now: state.phase.deadline!,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
}
let state = game.init({ players: makePlayers(8), seed: 19, now: 1_700_000_000_000, settings: {} });
save(state);
state = timer(state);
for (let row = 0; row < 24; row++) {
  for (let i = 1; i <= 8; i++) {
    if (row >= 28 - i * 2) continue;
    state = game.reduce(state, {
      type: 'input',
      now: state.began + row * 320 + i * 8,
      playerId: `p${i}`,
      input: { type: 'tap', row, column: state.sequence[row]! },
    });
  }
}
state = game.reduce(state, {
  type: 'input',
  now: state.began + 8100,
  playerId: 'p7',
  input: {
    type: 'tap',
    row: state.runs.p7!.tiles,
    column: (state.sequence[state.runs.p7!.tiles]! + 1) % 4,
  },
});
save(state);
state = game.reduce(state, {
  type: 'timer',
  phaseId: state.phase.id,
  startedAt: state.phase.startedAt,
  now: state.endsAt,
});
save(state);
state = timer(state);
save(state);
console.log('Wrote ready, play, score, done from one real event history.');
