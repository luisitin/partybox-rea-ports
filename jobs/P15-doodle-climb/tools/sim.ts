import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { game } from '../../../games/doodle-climb/server/index';
import { simulate } from './simulation';

const count = Number(process.argv[2] ?? 1000);
const reactionMs: [number, number] = [
  Number(process.argv[3] ?? 300),
  Number(process.argv[4] ?? 1200),
];
if (!Number.isInteger(count) || count < 1)
  throw new Error('match count must be a positive integer');
if (reactionMs.some((n) => !Number.isInteger(n) || n < 1) || reactionMs[1] < reactionMs[0])
  throw new Error('invalid reaction range');
const summaries: unknown[] = [];
const started = performance.now();
const median = (values: number[]): number => {
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
};
for (let players = 2; players <= 8; players++) {
  const durations: number[] = [];
  const rounds: number[] = [];
  const heights: number[] = [];
  let events = 0;
  let inputs = 0;
  let dead = 0;
  let climberRounds = 0;
  const heightBySkill = { easy: [] as number[], normal: [] as number[], sharp: [] as number[] };
  for (let seed = 1; seed <= count; seed++) {
    const run = simulate(players, seed, undefined, reactionMs);
    durations.push(run.simulatedMs);
    rounds.push(...run.roundsMs);
    heights.push(...Object.values(run.state.scores));
    events += run.events;
    inputs += run.inputs;
    dead += run.dead;
    climberRounds += run.climberRounds;
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      heightBySkill[skill].push(...run.heightBySkill[skill]);
  }
  const skillMeanRoundHeight = Object.fromEntries(
    Object.entries(heightBySkill).map(([skill, values]) => [
      skill,
      Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    ]),
  );
  const summary = {
    players,
    matches: count,
    terminated: count,
    skills: 'mixed easy/normal/sharp, rotating by seed and seat',
    reactionMs,
    maxMatchMs: Math.max(...durations),
    medianMatchMs: median(durations),
    medianRoundMs: median(rounds),
    medianMatchScore: median(heights),
    deathPercent: Math.round((dead * 1000) / climberRounds) / 10,
    skillMeanRoundHeight,
    events,
    inputs,
  };
  summaries.push(summary);
  console.log(JSON.stringify(summary));
}
const report = {
  game: game.manifest.id,
  seedRange: [1, count],
  budgetMs: game.manifest.estimatedMinutes * 2 * 60_000,
  defaultSettings: { rounds: 3, seconds: 60 },
  totalMatches: count * 7,
  wallSeconds: Math.round((performance.now() - started) / 1000),
  summaries,
};
const filename =
  count === 1000 ? './sim-results.json' : `./sim-trial-${count}-${reactionMs.join('-')}.json`;
writeFileSync(
  fileURLToPath(new URL(filename, import.meta.url)),
  JSON.stringify(report, null, 2) + '\n',
  'utf8',
);
