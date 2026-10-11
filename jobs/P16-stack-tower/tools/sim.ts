// Seeded full-game simulation, deliberately single-process to respect the desktop CPU.
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/stack-tower/server/index';

const runs = Number(process.env['PB_SIM_RUNS'] ?? 1000);
const rows: {
  players: number;
  runs: number;
  medianRoundMs: number;
  maxMatchMs: number;
  averageBest: number;
}[] = [];
for (let n = 2; n <= 8; n++) {
  const durations: number[] = [];
  let best = 0;
  let match = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const rng = createRng(seed);
    const players = testPlayers(n, { bots: n });
    let state = game.init({ players, settings: {}, seed, now: 1000 });
    let scoreAt = 0;
    let steps = 0;
    while (!game.results(state)) {
      assert(state.phase.deadline !== null, 'unterminated phase has no deadline');
      const now = state.phase.deadline;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      if (state.phase.id === 'score') scoreAt = state.phase.startedAt;
      for (let i = 0; i < players.length; i++) {
        const skill: BotSkill = (['easy', 'normal', 'sharp'] as const)[(seed + i) % 3]!;
        const input = game.bot.sampleInput(state, players[i]!.id, rng, skill);
        if (input) {
          assert(game.inputSchema.safeParse(input).success, 'invalid bot input');
          state = game.reduce(state, { type: 'input', playerId: players[i]!.id, input, now });
        }
      }
      assert(++steps < 2000, 'simulation exceeded event cap');
    }
    const elapsed = state.phase.startedAt - 1000;
    assert(elapsed <= game.manifest.estimatedMinutes * 2 * 60_000, 'estimate × 2 exceeded');
    assert.equal(Object.keys(game.results(state)!.scores).length, n);
    durations.push(scoreAt - 1000);
    best += Object.values(state.scores).reduce((sum, height) => sum + height, 0);
    match = Math.max(match, elapsed);
  }
  durations.sort((a, b) => a - b);
  const row = {
    players: n,
    runs,
    medianRoundMs: durations[Math.floor(runs / 2)]!,
    maxMatchMs: match,
    averageBest: Math.round((best / (runs * n)) * 1000) / 1000,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
if (runs === 1000)
  writeFileSync(
    new URL('../media/simulation.json', import.meta.url),
    JSON.stringify(rows, null, 2) + '\n',
  );
