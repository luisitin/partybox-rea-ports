// Standalone sequential evidence run; never starts a browser or another game's tests.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/2048/server/index';
import type { State } from '../../../games/2048/server/types';

const counts = [2, 3, 4, 5, 6, 7, 8];
const skills = ['easy', 'normal', 'sharp'] as const;
const seedCount = Number(process.env['MERGE_SIM_SEEDS'] ?? 1000);
const beatMs = 2000;
const t0 = 1_000_000;
const output = resolve('jobs/P09-2048-race/simulation.json');
const started = performance.now();
const summaries: object[] = [];

for (const players of counts) {
  for (const skill of skills) {
    const lengths: number[] = [];
    const scores: number[] = [];
    const totalLengths: number[] = [];
    const reasons: Record<string, number> = {};
    let moves = 0;
    const began = performance.now();
    for (let seed = 1; seed <= seedCount; seed++) {
      const rng = createRng(seed * 31 + players);
      let state: State = game.init({
        players: testPlayers(players, { bots: players }),
        settings: {},
        seed,
        now: t0,
      });
      const ids = Object.keys(state.players);
      let checked = false;
      for (let beat = 1; beat <= 180 && state.phase.id === 'play'; beat++) {
        const now = t0 + beat * beatMs;
        if (state.phase.deadline !== null && now >= state.phase.deadline) {
          state = game.reduce(state, {
            type: 'timer',
            now: state.phase.deadline,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt,
          });
          break;
        }
        for (const id of ids) {
          if (state.phase.id !== 'play') break;
          const input = game.bot.sampleInput(state, id, rng, skill);
          if (!input) continue;
          if (!checked) {
            if (!game.inputSchema.safeParse(input).success)
              throw new Error(`Invalid bot: ${players}/${skill}/${seed}`);
            checked = true;
          }
          state = game.reduce(state, { type: 'input', now, playerId: id, input });
        }
      }
      const playMs = state.phase.startedAt - t0;
      if (state.phase.id !== 'reveal')
        throw new Error(`Race stuck: ${players}/${skill}/${seed}/${state.phase.id}`);
      lengths.push(playMs);
      const why = state.reason ?? 'missing';
      reasons[why] = (reasons[why] ?? 0) + 1;
      state = game.reduce(state, {
        type: 'timer',
        now: state.phase.deadline!,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      totalLengths.push(state.phase.startedAt - t0);
      const results = game.results(state);
      if (!results || state.phase.id !== 'done')
        throw new Error(`No results: ${players}/${skill}/${seed}`);
      if (state.phase.startedAt - t0 > game.manifest.estimatedMinutes * 2 * 60_000)
        throw new Error(`Over time budget: ${players}/${skill}/${seed}`);
      if (Object.keys(results.scores).length !== players || !results.winnerIds.length)
        throw new Error(`Incomplete rankings: ${players}/${skill}/${seed}`);
      for (const id of ids) {
        const value = results.scores[id];
        if (value === undefined || !Number.isFinite(value)) throw new Error(`Invalid score: ${id}`);
        scores.push(value);
        moves += state.racers[id]!.moves;
      }
    }
    lengths.sort((a, b) => a - b);
    scores.sort((a, b) => a - b);
    const middle = Math.floor(lengths.length / 2);
    const median =
      lengths.length % 2 ? lengths[middle]! : (lengths[middle - 1]! + lengths[middle]!) / 2;
    const summary = {
      players,
      skill,
      seeds: seedCount,
      beatMs,
      medianPlayMs: median,
      maxPlayMs: lengths.at(-1),
      maxTotalMs: Math.max(...totalLengths),
      medianScore: scores[Math.floor(scores.length / 2)],
      totalAcceptedMoves: moves,
      reasons,
      elapsedMs: Math.round(performance.now() - began),
    };
    summaries.push(summary);
    writeFileSync(
      output,
      `${JSON.stringify({ seedRange: [1, seedCount], counts, skills, summaries }, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify(summary));
  }
}
console.log(
  JSON.stringify({
    games: counts.length * skills.length * seedCount,
    elapsedMs: Math.round(performance.now() - started),
    output,
  }),
);
