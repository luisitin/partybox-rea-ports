// One process, no browser. Drive the actual reducer with its 200 ms engine clock and 1 s bot decisions.
import { createRng } from '../../packages/game-sdk/src/index';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../../games/agar-io/server/index';
import { ROUND_MS } from '../../games/agar-io/server/types';
import type { State } from '../../games/agar-io/server/types';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { behaviorSources, dependencySources, root, sameSources } from './provenance.mjs';

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
  medianGameMs: number;
  maxGameMs: number;
  minScore: number;
  maxScore: number;
  totalEvents: number;
  maxEvents: number;
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
  // Each seat observes the same public snapshot. Its choices do not depend on
  // how many random draws another bot makes, or on which input is applied first.
  const botRngs = roster.map((_, seat) => createRng(seed ^ (0x5a17beef + seat * 0x9e3779b9)));
  const orderRng = createRng(seed ^ 0x41c64e6d);
  let now = T0;
  let nextBot = T0 + BOT_BEAT_MS;
  const roundsMs: number[] = [];
  let events = 0;
  while (state.phase.id !== 'done') {
    const deadline = state.phase.deadline;
    if (deadline === null || now - T0 > BUDGET_MS || events >= 5000)
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
    const snapshot = state;
    const decisions = roster.map((player, seat) => ({
      playerId: player.id,
      input: game.bot.sampleInput(snapshot, player.id, botRngs[seat]!, skill),
    }));
    for (const { playerId, input: bot } of orderRng.shuffle(decisions)) {
      if (bot === null) continue;
      const parsed = game.inputSchema.safeParse(bot);
      if (!parsed.success)
        throw new Error(
          `seed=${seed} n=${players} skill=${skill}: invalid bot input ${JSON.stringify(bot)}`,
        );
      if (events >= 5000) throw new Error(`seed=${seed}: exceeded the 5,000-event SDK cap`);
      state = game.reduce(state, { type: 'input', now, playerId, input: parsed.data });
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
  onCompleted?: (game: SimGame) => void,
): SimReport {
  if (
    !Number.isInteger(runs) ||
    runs < 1 ||
    skills.length === 0 ||
    skills.some((skill) => !SKILLS.includes(skill))
  )
    throw new Error('Invalid simulation count or skill coverage');
  const rounds: number[] = [];
  const durations: number[] = [];
  const gamesBySkill: Record<BotSkill, number> = { easy: 0, normal: 0, sharp: 0 };
  let maxGameMs = 0;
  let minScore = Infinity;
  let maxScore = 0;
  let totalEvents = 0;
  let maxEvents = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const skill = skills[(seed - 1) % skills.length]!;
    const run = simulate(players, seed, skill);
    gamesBySkill[skill]++;
    durations.push(run.durationMs);
    rounds.push(...run.roundsMs);
    maxGameMs = Math.max(maxGameMs, run.durationMs);
    minScore = Math.min(minScore, ...Object.values(run.totalScores));
    maxScore = Math.max(maxScore, ...Object.values(run.totalScores));
    totalEvents += run.events;
    maxEvents = Math.max(maxEvents, run.events);
    onCompleted?.(run);
  }
  rounds.sort((a, b) => a - b);
  const middle = Math.floor(rounds.length / 2);
  const medianRoundMs =
    rounds.length % 2 ? rounds[middle]! : (rounds[middle - 1]! + rounds[middle]!) / 2;
  durations.sort((a, b) => a - b);
  const gameMiddle = Math.floor(durations.length / 2);
  const medianGameMs =
    durations.length % 2
      ? durations[gameMiddle]!
      : (durations[gameMiddle - 1]! + durations[gameMiddle]!) / 2;
  return {
    players,
    games: runs,
    gamesBySkill,
    medianRoundMs,
    medianGameMs,
    maxGameMs,
    minScore,
    maxScore,
    totalEvents,
    maxEvents,
  };
}

// The normal verification path gets these same seven groups from one full Vitest run.
// A standalone diagnostic remains available, but cannot leave a historical PASS behind.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/P05-blob-arena/sim.ts')) {
  const runs = Number(process.env['PB_SIM_RUNS'] ?? 1000);
  const counts = (process.env['PB_SIM_COUNTS'] ?? '2,3,4,5,6,7,8').split(',').map(Number);
  const skills = (process.env['PB_SIM_SKILLS'] ?? SKILLS.join(',')).split(',') as BotSkill[];
  if (
    !Number.isInteger(runs) ||
    runs < 1 ||
    new Set(counts).size !== counts.length ||
    counts.some((n) => !Number.isInteger(n) || n < 2 || n > 8) ||
    skills.length === 0 ||
    skills.some((skill) => !SKILLS.includes(skill))
  )
    throw new Error('Invalid PB_SIM_RUNS, PB_SIM_COUNTS or PB_SIM_SKILLS');
  const sources = { ...behaviorSources(), ...dependencySources() };
  const output = resolve(root, 'jobs/P05-blob-arena/sim-report.json');
  const began = performance.now();
  const startedAt = new Date().toISOString();
  const reports: SimReport[] = [];
  let games = 0;
  let finishedAt: string | null = null;
  const canonical =
    runs === 1000 &&
    counts.length === 7 &&
    [2, 3, 4, 5, 6, 7, 8].every((count) => counts.includes(count)) &&
    skills.length === 3 &&
    SKILLS.every((skill) => skills.includes(skill));
  function checkpoint(status: string): void {
    writeFileSync(
      output,
      JSON.stringify(
        {
          runId: 'r1-local',
          status,
          incomplete: status !== 'passed',
          startedAt,
          finishedAt,
          elapsedMs: Math.round(performance.now() - began),
          command: 'node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/sim.ts',
          sourceScope:
            'All server/content/manifest bytes plus local SDK/shared/dependency configuration',
          sources,
          runsPerCount: runs,
          seedRange: [1, runs],
          counts,
          skills,
          expectedGames: counts.length * runs,
          games,
          maxAllowedGameMs: BUDGET_MS,
          maxAllowedEvents: 5000,
          reports,
          totalEvents: reports.reduce((sum, report) => sum + report.totalEvents, 0),
          maxGameMs: reports.length ? Math.max(...reports.map((report) => report.maxGameMs)) : null,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }
  checkpoint('running');
  try {
    for (const players of counts) {
      reports.push(
        sweep(players, runs, skills, () => {
          games++;
          if (games % 25 === 0) checkpoint('running');
        }),
      );
      checkpoint('running');
      console.log(JSON.stringify(reports.at(-1)));
      await new Promise((resume) => setTimeout(resume, 10));
    }
    if (!sameSources(sources, { ...behaviorSources(), ...dependencySources() }))
      throw new Error('Game/SDK source changed during simulations; rerun against frozen source');
    finishedAt = new Date().toISOString();
    checkpoint(canonical ? 'passed' : 'diagnostic');
  } catch (failure) {
    checkpoint('failed');
    throw failure;
  }
}
