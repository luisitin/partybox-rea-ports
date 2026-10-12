// One process, no browser. Drive the actual reducer with its 200 ms engine clock and 1 s bot decisions.
import { createRng } from '../../packages/game-sdk/src/index';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../../games/agar-io/server/index';
import { ROUND_MS } from '../../games/agar-io/server/types';
import type { State } from '../../games/agar-io/server/types';

export const SKILLS: BotSkill[] = ['easy', 'normal', 'sharp'];
const T0 = 1_000_000;
const BOT_BEAT_MS = 1000;
const BUDGET_MS = game.manifest.estimatedMinutes * 2 * 60000;

export interface SimGame {
  seed: number;
  players: number;
  skill: BotSkill;
  durationMs: number;
  roundsMs: number[];
  totalScores: Record<string, number>;
  events: number;
}

export interface SimReport {
  players: number;
  games: number;
  gamesBySkill: Record<BotSkill, number>;
  medianRoundMs: number;
  maxGameMs: number;
  minScore: number;
  maxScore: number;
  totalEvents: number;
}

export function simulate(players: number, seed: number, skill: BotSkill = 'normal'): SimGame {
  const roster = Array.from({ length: players }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    avatarId: 'fox',
    connected: true,
    bot: true,
  }));
  let state: State = game.init({ players: roster, seed, settings: {}, now: T0 });
  const rng = createRng(seed ^ 0x5a17beef);
  let now = T0;
  let nextBot = T0 + BOT_BEAT_MS;
  const roundsMs: number[] = [];
  let events = 0;
  while (state.phase.id !== 'done') {
    const deadline = state.phase.deadline;
    if (deadline === null || now - T0 > BUDGET_MS || events > 10000)
      throw new Error(
        `seed=${seed} n=${players} skill=${skill}: stuck in ${state.phase.id} at ${now - T0} ms / ${events} events`,
      );
    now = deadline;
    const before = state;
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    events++;
    if (before.phase.id === 'play' && state.phase.id === 'score') roundsMs.push(state.world.time);
    if (state.phase.id !== 'play') continue;
    if (before.phase.id !== 'play') nextBot = state.began + BOT_BEAT_MS;
    if (now < nextBot) continue;
    for (const player of roster) {
      const bot = game.bot.sampleInput(state, player.id, rng, skill);
      if (bot === null) continue;
      const parsed = game.inputSchema.safeParse(bot);
      if (!parsed.success)
        throw new Error(
          `seed=${seed} n=${players} skill=${skill}: invalid bot input ${JSON.stringify(bot)}`,
        );
      state = game.reduce(state, { type: 'input', now, playerId: player.id, input: parsed.data });
      events++;
    }
    nextBot = now + BOT_BEAT_MS;
  }
  const result = game.results(state);
  if (
    !result ||
    result.ranking.length !== players ||
    result.ranking.some((row) => !Number.isFinite(row.score))
  )
    throw new Error(`seed=${seed}: incomplete results`);
  if (roundsMs.length !== 3 || roundsMs.some((ms) => ms !== ROUND_MS))
    throw new Error(`seed=${seed}: wrong round duration ${JSON.stringify(roundsMs)}`);
  if (now - T0 > BUDGET_MS) throw new Error(`seed=${seed}: exceeded ${BUDGET_MS} ms`);
  return {
    seed,
    players,
    skill,
    durationMs: now - T0,
    roundsMs,
    totalScores: state.scores,
    events,
  };
}

export function sweep(
  players: number,
  runs = 1000,
  skills: readonly BotSkill[] = SKILLS,
): SimReport {
  const rounds: number[] = [];
  const gamesBySkill: Record<BotSkill, number> = { easy: 0, normal: 0, sharp: 0 };
  let maxGameMs = 0;
  let minScore = Infinity;
  let maxScore = 0;
  let totalEvents = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const skill = skills[(seed - 1) % skills.length]!;
    const run = simulate(players, seed, skill);
    gamesBySkill[skill]++;
    rounds.push(...run.roundsMs);
    maxGameMs = Math.max(maxGameMs, run.durationMs);
    minScore = Math.min(minScore, ...Object.values(run.totalScores));
    maxScore = Math.max(maxScore, ...Object.values(run.totalScores));
    totalEvents += run.events;
  }
  rounds.sort((a, b) => a - b);
  const middle = Math.floor(rounds.length / 2);
  const medianRoundMs =
    rounds.length % 2 ? rounds[middle]! : (rounds[middle - 1]! + rounds[middle]!) / 2;
  return {
    players,
    games: runs,
    gamesBySkill,
    medianRoundMs,
    maxGameMs,
    minScore,
    maxScore,
    totalEvents,
  };
}

// Root's TS loader resolves extensionless imports. Vitest imports the functions without invoking CLI.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/P05-blob-arena/sim.ts')) {
  const runs = Number(process.env['PB_SIM_RUNS'] ?? 1000);
  const counts = (process.env['PB_SIM_COUNTS'] ?? '2,3,4,5,6,7,8').split(',').map(Number);
  const skills = (process.env['PB_SIM_SKILLS'] ?? SKILLS.join(',')).split(',') as BotSkill[];
  if (
    !Number.isInteger(runs) ||
    runs < 1 ||
    counts.some((n) => !Number.isInteger(n) || n < 2 || n > 8) ||
    skills.some((skill) => !SKILLS.includes(skill))
  )
    throw new Error('Invalid PB_SIM_RUNS, PB_SIM_COUNTS or PB_SIM_SKILLS');
  for (const players of counts) console.log(JSON.stringify(sweep(players, runs, skills)));
}
