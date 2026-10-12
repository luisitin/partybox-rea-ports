// Standalone sequential evidence run; never starts a browser or another game's tests.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/2048/server/index';
import type { State } from '../../../games/2048/server/types';

const counts = [2, 3, 4, 5, 6, 7, 8];
const skills = ['easy', 'normal', 'sharp'] as const;
const seedCount = Number(process.env['MERGE_SIM_SEEDS'] ?? 1000);
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error('Invalid MERGE_SIM_SEEDS');
const beatMs = 2000;
const t0 = 1_000_000;
const limitMs = game.manifest.estimatedMinutes * 2 * 60_000;
const expectedGames = counts.length * skills.length * seedCount;
const output = resolve('jobs/P09-2048-race/simulation.json');
const started = performance.now();
const startedAt = new Date().toISOString();
const summaries: object[] = [];
let completedGames = 0;
let finishedAt: string | null = null;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  );
}
const paths = ['games/2048/manifest.json', ...sourceFiles('games/2048/server')].sort();
function sourceHashes(): Record<string, string> {
  return Object.fromEntries(
    paths.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  );
}
const sources = sourceHashes();
function checkpoint(incomplete = true): void {
  writeFileSync(
    output,
    `${JSON.stringify(
      {
        startedAt,
        finishedAt,
        seedRange: [1, seedCount],
        counts,
        skills,
        limitMs,
        expectedGames,
        completedGames,
        incomplete,
        elapsedMs: Math.round(performance.now() - started),
        sources,
        summaries,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}
// Publish fresh metadata before running: interruption cannot leave a historical PASS behind.
checkpoint();

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
          if (!game.inputSchema.safeParse(input).success)
            throw new Error(`Invalid bot: ${players}/${skill}/${seed}`);
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
      if (state.phase.startedAt - t0 > limitMs)
        throw new Error(`Over time budget: ${players}/${skill}/${seed}`);
      if (Object.keys(results.scores).length !== players || !results.winnerIds.length)
        throw new Error(`Incomplete rankings: ${players}/${skill}/${seed}`);
      for (const id of ids) {
        const value = results.scores[id];
        if (value === undefined || !Number.isFinite(value)) throw new Error(`Invalid score: ${id}`);
        scores.push(value);
        moves += state.racers[id]!.moves;
      }
      completedGames++;
      // One sequential process; yield regularly to keep the desktop responsive.
      if (seed % 25 === 0) await new Promise((resume) => setTimeout(resume, 10));
    }
    const medianPlayMs = median(lengths);
    const medianTotalMs = median(totalLengths);
    const medianScore = median(scores);
    const summary = {
      players,
      skill,
      seeds: seedCount,
      beatMs,
      completedGames: seedCount,
      medianPlayMs,
      medianTotalMs,
      maxPlayMs: lengths.at(-1),
      maxTotalMs: Math.max(...totalLengths),
      medianScore,
      totalAcceptedMoves: moves,
      reasons,
      elapsedMs: Math.round(performance.now() - began),
    };
    summaries.push(summary);
    checkpoint();
    console.log(JSON.stringify(summary));
  }
}
if (JSON.stringify(sourceHashes()) !== JSON.stringify(sources))
  throw new Error('Game source changed during simulations; rerun against the new source');
finishedAt = new Date().toISOString();
checkpoint(false);
console.log(
  JSON.stringify({
    games: completedGames,
    elapsedMs: Math.round(performance.now() - started),
    output,
  }),
);
