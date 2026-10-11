// A real clock-driven bot race: 1,000 seeds at every supported count and all three strengths.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOT_SKILLS, createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/tile-tempo/server/index';
import type { State } from '../../../games/tile-tempo/server/types';

const t0 = 1_000_000;
const budgetMs = game.manifest.estimatedMinutes * 2 * 60_000;
interface Summary {
  players: number;
  strength: BotSkill;
  seeds: number;
  terminated: number;
  medianPlayMs: number;
  maxMatchMs: number;
  meanTilesPerPlayer: number;
}
function timer(state: State): State {
  if (state.phase.deadline === null) throw new Error(`no deadline in ${state.phase.id}`);
  return game.reduce(state, {
    type: 'timer',
    now: state.phase.deadline,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
}
function simulate(
  players: number,
  strength: BotSkill,
  seed: number,
): { playMs: number; matchMs: number; tiles: number } {
  const roster = testPlayers(players, { bots: players });
  const rng = createRng(seed ^ 0x19_18);
  let state = game.init({
    players: roster,
    settings: {},
    seed,
    now: t0,
    ...(strength === 'normal' ? {} : { botSkill: strength }),
  });
  state = timer(state);
  let steps = 0;
  while (state.phase.id === 'play') {
    if (++steps > 1000) throw new Error(`stalled n=${players} ${strength} seed=${seed}`);
    const now = state.phase.deadline!;
    state = timer(state);
    for (const player of roster) {
      if (state.phase.id !== 'play') break;
      const input = game.bot.sampleInput(state, player.id, rng, strength);
      if (!input) continue;
      if (!game.inputSchema.safeParse(input).success)
        throw new Error(`invalid bot input n=${players} ${strength} seed=${seed}`);
      state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
    }
  }
  const playMs = state.elapsed;
  while (game.results(state) === null && steps++ < 1010) state = timer(state);
  const results = game.results(state);
  const matchMs = state.phase.startedAt - t0;
  if (!results || matchMs > budgetMs || playMs > 30_000)
    throw new Error(`failed termination n=${players} ${strength} seed=${seed}`);
  if (Object.keys(results.scores).length !== players || results.winnerIds.length === 0)
    throw new Error(`incomplete results n=${players} ${strength} seed=${seed}`);
  return { playMs, matchMs, tiles: Object.values(results.scores).reduce((a, b) => a + b, 0) };
}

const summaries: Summary[] = [];
for (const players of [2, 3, 4, 5, 6, 7, 8]) {
  for (const strength of BOT_SKILLS) {
    const lengths: number[] = [];
    let maxMatchMs = 0;
    let totalTiles = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const result = simulate(players, strength, seed);
      lengths.push(result.playMs);
      maxMatchMs = Math.max(maxMatchMs, result.matchMs);
      totalTiles += result.tiles;
    }
    lengths.sort((a, b) => a - b);
    summaries.push({
      players,
      strength,
      seeds: 1000,
      terminated: lengths.length,
      medianPlayMs: (lengths[499]! + lengths[500]!) / 2,
      maxMatchMs,
      meanTilesPerPlayer: Math.round(totalTiles / players / 10) / 100,
    });
    process.stdout.write(
      `n=${players} ${strength}: 1000 terminated; median ${summaries.at(-1)!.medianPlayMs}ms\n`,
    );
  }
}
const report = {
  game: game.manifest.id,
  seeds: '1..1000 at every supported player count and strength',
  totalGames: summaries.reduce((n, row) => n + row.terminated, 0),
  budgetMs,
  summaries,
};
const output = fileURLToPath(new URL('../SIMULATION.json', import.meta.url));
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${report.totalGames} games terminated within ${budgetMs}ms; wrote SIMULATION.json\n`,
);
