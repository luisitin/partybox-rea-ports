import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { ROUND_MS } from '../server/world';

// A delayed engine timer is legal. This runner batches 400 ms of server physics
// per beat rather than scheduling every 100 ms tick, while real bots still move
// on every beat. The fixed 20 ms judging grid is unchanged.
function activeGame(players: number, seed: number) {
  const rng = createRng(seed);
  const roster = makePlayers(players).map((player) => ({ ...player, bot: true }));
  const skill: BotSkill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
  let state = game.init({ players: roster, settings: {}, seed, now: 1000 });
  let now = 1000;
  let inputs = 0;
  let beats = 0;
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  while (game.results(state) === null && now - 1000 <= budget && beats < 1000) {
    if (state.phase.id === 'play') {
      now = Math.min(state.endsAt, now + 400);
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      for (const player of roster) {
        if (state.phase.id !== 'play') break;
        const input = game.bot.sampleInput(state, player.id, rng, skill);
        if (input === null) continue;
        if (!game.inputSchema.safeParse(input).success)
          throw new Error(`invalid bot: ${seed}/${player.id}`);
        state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
        inputs++;
      }
    } else {
      now = state.phase.deadline ?? now + 1000;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
    }
    beats++;
  }
  const result = game.results(state);
  if (!result) throw new Error(`stuck seed=${seed} players=${players} phase=${state.phase.id}`);
  if (inputs === 0) throw new Error(`inactive bots seed=${seed}`);
  if (now - 1000 > budget) throw new Error(`over budget seed=${seed}`);
  const expected = roster
    .map((player) => player.id)
    .sort()
    .join(',');
  if (Object.keys(result.scores).sort().join(',') !== expected)
    throw new Error(`incomplete results seed=${seed}`);
  if (!Object.values(result.scores).every(Number.isFinite))
    throw new Error(`nonfinite scores seed=${seed}`);
  return { roundMs: state.checked, matchMs: now - 1000, inputs, skill };
}

it('simulation: 1000 active seeded bot games at every player count 2–8 finish within estimate × 2', () => {
  const sizes = [2, 3, 4, 5, 6, 7, 8];
  const report = sizes.map((players) => {
    const games = Array.from({ length: 1000 }, (_, index) => activeGame(players, index + 1));
    const lengths = games.map((run) => run.roundMs).sort((a, b) => a - b);
    const medianMs = (lengths[499]! + lengths[500]!) / 2;
    expect(lengths.at(-1)).toBeLessThanOrEqual(ROUND_MS);
    expect(medianMs).toBeGreaterThan(10_000);
    const stats = {
      players,
      games: games.length,
      seeds: { first: 1, last: 1000 },
      skills: { easy: 334, normal: 333, sharp: 333 },
      medianRoundMs: medianMs,
      minRoundMs: lengths[0],
      maxRoundMs: lengths.at(-1),
      maxMatchMs: Math.max(...games.map((run) => run.matchMs)),
      totalBotInputs: games.reduce((total, run) => total + run.inputs, 0),
      terminated: games.length,
    };
    console.log(
      `P21 ${players} bots: ${stats.games} games; median ${medianMs / 1000}s; max ${stats.maxMatchMs / 1000}s`,
    );
    return stats;
  });
  const directory = resolve('jobs/P21-pong-party');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'simulation.json'),
    `${JSON.stringify({ reactionMs: 400, budgetMs: game.manifest.estimatedMinutes * 2 * 60_000, groups: report }, null, 2)}\n`,
    'utf8',
  );
}, 240_000);
