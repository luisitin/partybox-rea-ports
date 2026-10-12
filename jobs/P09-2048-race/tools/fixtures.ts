// Build phase fixtures from one genuine seeded eight-player match.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { game } from '../../../games/2048/server/index';
import type { State } from '../../../games/2048/server/types';

const names = ['Ava', 'Diego', 'Mei', 'Sam', 'Priya', 'Leo', 'Nora', 'Jules'];
const players = names.map((name, i) => ({
  id: `p${i + 1}`,
  name,
  avatarId: 'fox',
  connected: true,
  bot: true,
}));
const random = createRng(371);
let state = game.init({ players, now: 1_000_000, seed: 71, settings: {} });
const captured: Record<string, State> = {};
for (let beat = 1; state.phase.id === 'play' && beat <= 361; beat++) {
  const now = 1_000_000 + beat * 500;
  for (const p of players) {
    const skill =
      Number(p.id.slice(1)) % 3 === 0
        ? 'sharp'
        : Number(p.id.slice(1)) % 3 === 1
          ? 'easy'
          : 'normal';
    const input = game.bot.sampleInput(state, p.id, random, skill);
    if (input) state = game.reduce(state, { type: 'input', now, playerId: p.id, input });
    if (state.phase.id !== 'play') break;
  }
  if (beat === 90) captured.play = state;
  if (state.phase.id === 'play' && state.phase.deadline !== null && now >= state.phase.deadline)
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: 'play',
      startedAt: state.phase.startedAt,
    });
}
if (state.phase.id !== 'reveal' || !captured.play)
  throw new Error('Fixture game did not reach expected phases');
captured.reveal = state;
captured.done = game.reduce(state, {
  type: 'timer',
  now: state.phase.deadline!,
  phaseId: 'reveal',
  startedAt: state.phase.startedAt,
});
if (captured.done.phase.id !== 'done' || game.results(captured.done) === null)
  throw new Error('Fixture game did not reach complete results');
const check = process.argv.includes('--check');
if (!check) mkdirSync('games/2048/fixtures', { recursive: true });
for (const [name, snapshot] of Object.entries(captured)) {
  const path = `games/2048/fixtures/${name}.json`;
  if (check) {
    if (JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))) !== JSON.stringify(snapshot))
      throw new Error(`Fixture differs from the genuine current seeded match: ${name}`);
  } else writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(captured).map(([phase, s]) => [
        phase,
        {
          startedAt: s.phase.startedAt,
          holdMs: s.phase.deadline === null ? null : s.phase.deadline - s.phase.startedAt,
          racers: game.tvView(s).racers.map((r) => ({
            name: names[Number(r.id.slice(1)) - 1],
            best: r.best,
            score: r.score,
            moves: r.moves,
          })),
        },
      ]),
    ),
    null,
    2,
  ),
);
