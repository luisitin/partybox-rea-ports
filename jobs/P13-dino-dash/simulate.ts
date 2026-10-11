import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotSkill } from '@partybox/game-sdk';
import { BUDGET_MS, median, simulateOne } from './simulation';

const root = dirname(fileURLToPath(import.meta.url));
const seedArg = process.argv.indexOf('--seeds');
const seeds = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 1000;
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds must be a positive integer');
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const server = join(root, '../../games/dino-dash/server');
const sources = readdirSync(server, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.ts'))
  .sort();
const sourceSha256 = sha256(
  sources.map((path) => `${path.replaceAll('\\', '/')}\n${readFileSync(join(server, path), 'utf8')}`).join('\n'),
);
const rows: {
  players: number;
  skill: BotSkill;
  seeds: number;
  terminal: number;
  medianRoundMs: number;
  medianMatchMs: number;
  maximumMatchMs: number;
  medianPlayerScore: number;
  meanPlayerScore: number;
  fullTieMatches: number;
  fullTieMatchesPercent: number;
  replaySha256: string;
}[] = [];
for (const players of [2, 4, 8, 3, 5, 6, 7]) {
  for (const skill of ['easy', 'normal', 'sharp'] as const) {
    const roundLengths: number[] = [];
    const matchLengths: number[] = [];
    const playerScores: number[] = [];
    let fullTieMatches = 0;
    const hash = createHash('sha256');
    for (let seed = 1; seed <= seeds; seed++) {
      const run = simulateOne(players, seed, skill);
      roundLengths.push(...run.roundLengths);
      matchLengths.push(run.elapsed);
      const scores = Object.values(run.final.scores);
      playerScores.push(...scores);
      if (new Set(scores).size === 1) fullTieMatches++;
      hash.update(JSON.stringify({ seed, scores: run.final.scores, lengths: run.roundLengths }));
    }
    const row = {
      players,
      skill,
      seeds,
      terminal: seeds,
      medianRoundMs: median(roundLengths),
      medianMatchMs: median(matchLengths),
      maximumMatchMs: Math.max(...matchLengths),
      medianPlayerScore: median(playerScores),
      meanPlayerScore: Number(
        (playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length).toFixed(3),
      ),
      fullTieMatches,
      fullTieMatchesPercent: Number(((100 * fullTieMatches) / seeds).toFixed(2)),
      replaySha256: hash.digest('hex'),
    };
    rows.push(row);
    console.log(
      `${players} players ${skill}: ${seeds}/${seeds}, median round ${row.medianRoundMs}ms, mean player ${row.meanPlayerScore}, full ties ${row.fullTieMatchesPercent}%`,
    );
  }
}
const report =
  JSON.stringify(
    { seedRange: [1, seeds], reactionMs: 100, rounds: 3, budgetMs: BUDGET_MS, sourceSha256, rows },
    null,
    2,
  ) + '\n';
writeFileSync(join(root, 'simulation-results.json'), report, 'utf8');
writeFileSync(
  join(root, 'SIMULATION.md'),
  [
    '# Seeded bot simulation',
    '',
    `Command: \`pnpm tsx jobs/P13-dino-dash/simulate.ts${seeds === 1000 ? '' : ` --seeds ${seeds}`}\`.`,
    '',
    `Seeds 1–${seeds}, default 3 rounds, 100ms reactions, ${BUDGET_MS / 60_000} minute simulated budget.`,
    'Every sampled input passed the real input schema; every match returned complete finite results.',
    'Player score is cumulative metres over the three runs. Full tie means every runner finished the match on the same total; it exposes outcome variety even when a surviving runner reaches the round cap.',
    '',
    '| Players | Strength | Terminal | Median round (s) | Median match (s) | Maximum match (s) | Mean player score | Full ties |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.players} | ${r.skill} | ${r.terminal}/${r.seeds} | ${r.medianRoundMs / 1000} | ${r.medianMatchMs / 1000} | ${r.maximumMatchMs / 1000} | ${r.meanPlayerScore} | ${r.fullTieMatchesPercent}% |`,
    ),
    '',
    `Server source SHA-256: \`${sourceSha256}\`.`,
    `Results SHA-256: \`${sha256(report)}\`.`,
    'Per-cohort replay hashes are in simulation-results.json; rerunning unchanged code reproduces them.',
    '',
  ].join('\n'),
  'utf8',
);
