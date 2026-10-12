// Serial own-game simulation: no browser, no workers, no process fan-out.
// pnpm tsx jobs/P08-hole-swallow/simulate.ts --runs 1000 --counts 2,3,4,5,6,7,8
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { game } from '../../games/hole-io/server/index';
import type { State } from '../../games/hole-io/server/types';

export const T0 = 1_000_000;
const skills: BotSkill[] = ['easy', 'normal', 'sharp'];
export function initial(count: number, seed: number): State {
  return game.init({
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      avatarId: 'fox',
      connected: true,
      bot: true,
    })),
    seed,
    now: T0,
    settings: {},
  });
}

function steer(state: State, rng: Rng, skill: BotSkill, now: number): State {
  let next = state;
  for (const id of Object.keys(state.players)) {
    const input = game.bot.sampleInput(next, id, rng, skill);
    if (input === null) continue;
    const parsed = game.inputSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(`Invalid bot input ${skill}/${id}: ${JSON.stringify(input)}`);
    next = game.reduce(next, { type: 'input', playerId: id, now, input: parsed.data });
  }
  return next;
}

export function driveTo(from: State, elapsed: number, rng: Rng, skill: BotSkill = 'normal'): State {
  let state = steer(from, rng, skill, from.began + from.world.elapsed);
  while (state.phase.id === 'play' && state.world.elapsed < elapsed) {
    const now = state.began + Math.min(elapsed, state.world.elapsed + 1000);
    const before = state.world.elapsed;
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    if (state.world.elapsed <= before) throw new Error(`Simulation did not advance at ${before}`);
    if (state.phase.id === 'play') state = steer(state, rng, skill, now);
  }
  return state;
}

export function simulate(
  count: number,
  seed: number,
  skill: BotSkill = skills[seed % 3]!,
): {
  roundMs: number;
  totalMs: number;
  intake: number;
  predations: number;
} {
  const rng = createRng(seed);
  const reveal = driveTo(initial(count, seed), 90_000, rng, skill);
  if (reveal.phase.id !== 'reveal') throw new Error(`Seed ${seed}, count ${count} did not reveal`);
  const final = game.reduce(reveal, {
    type: 'timer',
    now: reveal.phase.deadline!,
    phaseId: reveal.phase.id,
    startedAt: reveal.phase.startedAt,
  });
  const result = game.results(final);
  if (final.phase.id !== 'done' || !result)
    throw new Error(`Seed ${seed}, count ${count} did not terminate`);
  if (
    Object.keys(result.scores).length !== count ||
    Object.values(result.scores).some((n) => !Number.isFinite(n))
  )
    throw new Error(`Seed ${seed}, count ${count} incomplete scores`);
  const totalMs = final.phase.startedAt - T0;
  if (totalMs > game.manifest.estimatedMinutes * 2 * 60_000)
    throw new Error(`Manifest budget exceeded: ${totalMs}`);
  return {
    roundMs: final.world.elapsed,
    totalMs,
    intake: Object.values(result.scores).reduce((sum, value) => sum + value, 0),
    predations: final.world.holes.reduce((sum, h) => sum + h.swallowed, 0),
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runs = Number(arg('--runs') ?? 1000);
  const counts = (arg('--counts') ?? '2,3,4,5,6,7,8').split(',').map(Number);
  if (
    !Number.isInteger(runs) ||
    runs < 1 ||
    counts.some((n) => !Number.isInteger(n) || n < 2 || n > 8)
  )
    throw new Error('Use --runs <positive integer> --counts <comma-separated integers 2..8>');
  const report = [];
  for (const count of counts) {
    const records = [];
    for (let seed = 1; seed <= runs; seed++) {
      records.push(simulate(count, seed));
      if (seed % 100 === 0) process.stderr.write(`${count} players: ${seed}/${runs} complete\n`);
    }
    const rounds = records.map((r) => r.roundMs).sort((a, b) => a - b);
    const mid = Math.floor(runs / 2);
    const medianRoundMs = runs % 2 ? rounds[mid]! : (rounds[mid - 1]! + rounds[mid]!) / 2;
    const row = {
      players: count,
      runs,
      seedFirst: 1,
      seedLast: runs,
      strengths: skills,
      medianRoundMs,
      maxTotalMs: Math.max(...records.map((r) => r.totalMs)),
      meanIntake: records.reduce((sum, r) => sum + r.intake, 0) / runs,
      meanPredations: records.reduce((sum, r) => sum + r.predations, 0) / runs,
    };
    report.push(row);
    process.stdout.write(`${JSON.stringify(row)}\n`);
  }
  writeFileSync(
    new URL('./simulation-results.json', import.meta.url),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}
