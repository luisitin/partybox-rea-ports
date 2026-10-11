import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRng } from '@partybox/game-sdk';
import { jsonSize, makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/crossy-streets/server/index';
import type { State } from '../../games/crossy-streets/server/types';

const job = resolve('jobs/P14-crossy-streets');
const strengths = ['easy', 'normal', 'sharp'] as const;
const arg = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
};
const runs = Number(arg('--runs', '1000'));
const counts = arg('--players', '2,3,4,5,6,7,8').split(',').map(Number);
const matrix = arg('--matrix', 'mixed');
const reportPath = arg('--out', resolve(job, 'sim-results.json'));
if (
  !Number.isInteger(runs) ||
  runs < 1 ||
  counts.some((n) => !Number.isInteger(n) || n < 2 || n > 8)
)
  throw new Error('Use --runs positive integer --players comma-separated counts from 2 to 8.');
const budget = game.manifest.estimatedMinutes * 2 * 60_000;
console.log(`Simulator PID ${process.pid}; ${runs} seeds for player counts ${counts.join(',')}.`);

function simulate(players: number, seed: number, strength: (typeof strengths)[number]) {
  const rng = createRng(seed);
  let state: State = game.init({
    players: makePlayers(players).map((p) => ({ ...p, bot: true })),
    settings: {},
    now: 1_000_000,
    seed,
    ...(strength === 'normal' ? {} : { botSkill: strength }),
  });
  const initAt = state.phase.startedAt;
  const ids = Object.keys(state.players);
  let events = 0;
  let now = initAt;
  while (state.phase.id !== 'done') {
    if (state.phase.deadline === null || events > 20_000 || now - initAt > budget)
      throw new Error(
        `stalled n=${players} seed=${seed} skill=${strength} phase=${state.phase.id}`,
      );
    now = state.phase.deadline;
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    events++;
    if (state.phase.id !== 'play') continue;
    for (const id of ids) {
      const input = game.bot.sampleInput(state, id, rng, strength);
      if (input === null) continue;
      if (!game.inputSchema.safeParse(input).success)
        throw new Error(`invalid bot input n=${players} seed=${seed} skill=${strength}`);
      state = game.reduce(state, { type: 'input', now, playerId: id, input });
      events++;
    }
  }
  const results = game.results(state);
  if (!results || Object.keys(results.scores).length !== players)
    throw new Error(`missing results n=${players} seed=${seed} skill=${strength}`);
  if (jsonSize(state) > 256 * 1024) throw new Error('state JSON exceeds SDK budget');
  return {
    roundMs: state.checked,
    totalMs: now - initAt,
    events,
    averageRows: Object.values(results.scores).reduce((n, score) => n + score, 0) / players,
    deaths: state.world.runners.reduce((n, runner) => n + runner.deaths, 0),
  };
}

const started = performance.now();
const rows: unknown[] = [];
mkdirSync(job, { recursive: true });
function persist(completed: boolean): void {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        command:
          `pnpm exec tsx jobs/P14-crossy-streets/simulate.ts ${process.argv.slice(2).join(' ')}`.trim(),
        seedRange: [1, runs],
        engine: 'real reduce + schema-checked sampleInput at every timer beat',
        matrix,
        completed,
        rows,
        wallMs: Math.round(performance.now() - started),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}
for (const players of counts) {
  for (const forced of matrix === 'full' ? strengths : [null]) {
    const lengths: number[] = [];
    const totals: number[] = [];
    const byStrength = { easy: 0, normal: 0, sharp: 0 };
    let events = 0;
    let scoreSum = 0;
    let deaths = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const strength = forced ?? strengths[(seed - 1) % strengths.length]!;
      const run = simulate(players, seed, strength);
      byStrength[strength]++;
      lengths.push(run.roundMs);
      totals.push(run.totalMs);
      events += run.events;
      scoreSum += run.averageRows;
      deaths += run.deaths;
    }
    lengths.sort((a, b) => a - b);
    const median = (lengths[Math.floor((runs - 1) / 2)]! + lengths[Math.floor(runs / 2)]!) / 2;
    const row = {
      players,
      strength: forced ?? 'mixed',
      runs,
      byStrength,
      terminated: runs,
      medianRoundMs: median,
      maxRoundMs: lengths.at(-1),
      maxTotalMs: Math.max(...totals),
      budgetMs: budget,
      events,
      meanRowsPerPlayer: scoreSum / runs,
      deaths,
    };
    rows.push(row);
    persist(false);
    console.log(JSON.stringify(row));
  }
}
persist(true);
console.log(`Saved ${reportPath}`);
