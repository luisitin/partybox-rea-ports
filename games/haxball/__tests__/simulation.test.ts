import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import { STEP_MS } from '../server/types';
import { start, timer, T0 } from './helpers';

const SKILLS: BotSkill[] = ['easy', 'normal', 'sharp'];
const REACTION_MS = 400; // Below the 650 ms lease; every underlying 50 ms physics step still runs.
interface Run {
  terminated: boolean;
  error: string | null;
  virtualMs: number;
  physicsSteps: number;
  kicks: number;
  goals: number;
  movement: number;
  release: number;
  kickAttempts: number;
  directions: string[];
}
interface Summary {
  players: number;
  games: number;
  attempted: number;
  status: 'running' | 'passed' | 'failed';
  failures: string[];
  failedRunCount: number;
  failedRunSamples: { seed: number; skill: BotSkill; error: string; virtualMs: number }[];
  settings: { halfSeconds: number };
  reactionMs: number;
  medianMs: number | null;
  maxMs: number | null;
  minMs: number | null;
  terminated: number;
  physicsSteps: number;
  kicks: number;
  goals: number;
  movement: number;
  release: number;
  kickAttempts: number;
  strengths: Record<string, { games: number; terminated: number; kicks: number; goals: number }>;
}
const summaries: Summary[] = [];
const plannedGames = 7000;
const writingEvidence = process.env['PB_WRITE_EVIDENCE'] === '1';
const folder = fileURLToPath(new URL('../../../jobs/P24-haxball/media/', import.meta.url));

function writeEvidence(): void {
  if (!writingEvidence) return;
  mkdirSync(folder, { recursive: true });
  const gameCount = summaries.reduce((total, item) => total + item.attempted, 0);
  const complete =
    gameCount === plannedGames &&
    summaries.length === 7 &&
    summaries.every((item) => item.status !== 'running');
  const status = complete
    ? summaries.every((item) => item.status === 'passed')
      ? 'passed'
      : 'failed'
    : 'running';
  writeFileSync(
    `${folder}/simulation.json`,
    `${JSON.stringify(
      {
        status,
        complete,
        plannedGames,
        gameCount,
        hasFailures: summaries.some((item) => item.status === 'failed' || item.failedRunCount > 0),
        terminated: summaries.reduce((total, item) => total + item.terminated, 0),
        failedRunCount: summaries.reduce((total, item) => total + item.failedRunCount, 0),
        seedScheme: '(i+1)*2654435761 + players*1009, uint32',
        defaultHalves: '2 x90 seconds',
        physicsStepMs: STEP_MS,
        reactionMs: REACTION_MS,
        medianPopulation: 'Successfully terminated, complete default matches only; null when none',
        strategyCoverage:
          'Movement/directions, accepted kicks, releases, and positive goal activity for every strength at every count; game.test pins striker/defender/support decisions',
        counts: [...summaries].sort((a, b) => a.players - b.players),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
// Clear a previous successful report before this run starts. Interrupted runs
// leave an honest running/partial record, never stale green measurements.
writeEvidence();

function run(count: number, seed: number, skill: BotSkill): Run {
  const rng = createRng(seed ^ 0x483be971);
  let state = start(count, seed);
  // Mark actual bot seats, as a running room does.
  state = {
    ...state,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, { ...player, bot: true }]),
    ),
  };
  const metrics: Run = {
    terminated: false,
    error: null,
    virtualMs: 0,
    physicsSteps: 0,
    kicks: 0,
    goals: 0,
    movement: 0,
    release: 0,
    kickAttempts: 0,
    directions: [],
  };
  const directions = new Set<string>();
  let batches = 0;
  const react = (): void => {
    // Sample one public snapshot, then apply every seat at the same event time.
    const ids = Object.keys(state.players);
    const offset = batches % ids.length;
    const order = [...ids.slice(offset), ...ids.slice(0, offset)];
    const choices = order.map((id) => ({
      id,
      choice: game.bot.sampleInput(state, id, rng, skill),
    }));
    for (const { id, choice } of choices) {
      if (choice === null) continue;
      if (!game.inputSchema.safeParse(choice).success)
        throw new Error(`Invalid bot input count=${count} seed=${seed} ${skill}`);
      metrics.movement += Number(choice.dx !== 0 || choice.dy !== 0);
      metrics.kickAttempts += Number(choice.kick);
      metrics.release += Number(!choice.kick && state.intents[id]?.kickHeld === true);
      directions.add(`${choice.dx},${choice.dy}`);
      state = game.reduce(state, { type: 'input', now: state.clock, playerId: id, input: choice });
    }
  };
  try {
    react();
    while (
      state.phase.id !== 'done' &&
      batches < 2000 &&
      state.clock - T0 <= game.manifest.estimatedMinutes * 2 * 60_000
    ) {
      const before = state;
      const now =
        state.phase.id === 'play'
          ? Math.min(state.clock + REACTION_MS, state.halfEndsAt)
          : state.phase.deadline;
      if (now === null || now <= state.clock)
        throw new Error(`Nonadvancing clock count=${count} seed=${seed} phase=${state.phase.id}`);
      state = timer(state, now);
      if (before.phase.id === 'play')
        metrics.physicsSteps += Math.max(0, state.simAt - before.simAt) / STEP_MS;
      else if (state.phase.id === 'play')
        metrics.physicsSteps += Math.max(0, state.simAt - state.phase.startedAt) / STEP_MS;
      for (const [id, intent] of Object.entries(state.intents))
        if (intent.lastKickAt !== null && intent.lastKickAt !== before.intents[id]?.lastKickAt)
          metrics.kicks++;
      metrics.goals += state.goals.red + state.goals.blue - before.goals.red - before.goals.blue;
      batches++;
      if (state.phase.id === 'play') react();
    }
    if (state.phase.id !== 'done' || game.results(state) === null)
      throw new Error(`Unterminated count=${count} seed=${seed} ${skill}`);
    if (state.half !== 2 || state.halfSeconds !== 90)
      throw new Error('Simulation did not play the default two90-second halves');
    const scores = game.results(state)!.scores;
    if (Object.keys(scores).length !== count || !Object.values(scores).every(Number.isFinite))
      throw new Error('Incomplete simulation result');
    metrics.terminated = true;
  } catch (error) {
    metrics.error = error instanceof Error ? error.message : String(error);
  }
  metrics.virtualMs = state.clock - T0;
  metrics.directions = [...directions];
  return metrics;
}

describe('default-length one-worker seeded bot simulation', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'terminates1000 default games at%i players with all three strengths represented',
    (players) => {
      const times: number[] = [];
      const summary: Summary = {
        players,
        games: 1000,
        attempted: 0,
        status: 'running',
        failures: [],
        failedRunCount: 0,
        failedRunSamples: [],
        settings: { halfSeconds: 90 },
        reactionMs: REACTION_MS,
        medianMs: null,
        maxMs: null,
        minMs: null,
        terminated: 0,
        physicsSteps: 0,
        kicks: 0,
        goals: 0,
        movement: 0,
        release: 0,
        kickAttempts: 0,
        strengths: Object.fromEntries(
          SKILLS.map((skill) => [skill, { games: 0, terminated: 0, kicks: 0, goals: 0 }]),
        ),
      };
      summaries.push(summary);
      writeEvidence();
      const directions = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const skill = SKILLS[i % SKILLS.length]!;
        const seed = (Math.imul(i + 1, 2654435761) + players * 1009) >>> 0;
        const result = run(players, seed, skill);
        summary.attempted++;
        if (result.terminated) {
          times.push(result.virtualMs);
          summary.terminated++;
        } else {
          summary.failedRunCount++;
          if (summary.failedRunSamples.length < 10)
            summary.failedRunSamples.push({
              seed,
              skill,
              error: result.error ?? 'Did not terminate',
              virtualMs: result.virtualMs,
            });
        }
        for (const key of [
          'physicsSteps',
          'kicks',
          'goals',
          'movement',
          'release',
          'kickAttempts',
        ] as const)
          summary[key] += result[key];
        summary.strengths[skill]!.games++;
        summary.strengths[skill]!.terminated += Number(result.terminated);
        summary.strengths[skill]!.kicks += result.kicks;
        summary.strengths[skill]!.goals += result.goals;
        result.directions.forEach((direction) => directions.add(direction));
        if (summary.attempted % 100 === 0) writeEvidence();
      }
      times.sort((a, b) => a - b);
      if (times.length > 0) {
        summary.medianMs =
          (times[Math.floor((times.length - 1) / 2)]! + times[Math.floor(times.length / 2)]!) / 2;
        summary.minMs = times[0]!;
        summary.maxMs = times.at(-1)!;
      }
      const require = (condition: boolean, reason: string): void => {
        if (!condition) summary.failures.push(reason);
      };
      require(summary.attempted === 1000 &&
        summary.terminated === 1000, 'Every one of 1000 attempted games must terminate');
      require(summary.failedRunCount === 0, 'Runtime/default-match/result failures must be zero');
      require(summary.minMs === 188_000 &&
        summary.maxMs === 188_000, 'Complete default match must take 188000 virtual milliseconds');
      require(summary.maxMs !== null &&
        summary.maxMs < game.manifest.estimatedMinutes * 2 * 60_000, 'Estimate ×2 budget');
      require(summary.physicsSteps > 1000, 'Real fixed-step physics must run');
      require(summary.kicks > 0 &&
        summary.goals > 0 &&
        summary.release > 0, 'Accepted kicks, goals and releases must occur');
      require(directions.size > 3, 'Bots must produce varied movement');
      for (const [skill, value] of Object.entries(summary.strengths)) {
        require(value.games >= 333 &&
          value.terminated === value.games, `${skill}: coverage/termination`);
        require(value.kicks > 0, `${skill}: no accepted kick activity`);
        require(value.goals > 0, `${skill}: no actual goal activity`);
      }
      summary.status = summary.failures.length === 0 ? 'passed' : 'failed';
      // Retain all metrics even when the following activity assertion fails.
      writeEvidence();
      console.log(JSON.stringify(summary));
      expect(
        summary.failures,
        `players=${players}, full metrics preserved in simulation.json`,
      ).toEqual([]);
    },
    300_000,
  );
});
