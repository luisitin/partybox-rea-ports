import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import { STEP_MS } from '../server/types';
import { start, timer, T0 } from './helpers';

const SKILLS: BotSkill[] = ['easy', 'normal', 'sharp'];
const REACTION_MS = 400; // Below the650ms lease; every underlying50ms physics step still runs.
interface Run {
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
  settings: { halfSeconds: number };
  reactionMs: number;
  medianMs: number;
  maxMs: number;
  minMs: number;
  terminated: number;
  physicsSteps: number;
  kicks: number;
  goals: number;
  movement: number;
  release: number;
  kickAttempts: number;
  strengths: Record<string, { games: number; kicks: number; goals: number }>;
}
const summaries: Summary[] = [];

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
        settings: { halfSeconds: 90 },
        reactionMs: REACTION_MS,
        medianMs: 0,
        maxMs: 0,
        minMs: 0,
        terminated: 0,
        physicsSteps: 0,
        kicks: 0,
        goals: 0,
        movement: 0,
        release: 0,
        kickAttempts: 0,
        strengths: Object.fromEntries(
          SKILLS.map((skill) => [skill, { games: 0, kicks: 0, goals: 0 }]),
        ),
      };
      const directions = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const skill = SKILLS[i % SKILLS.length]!;
        const seed = (Math.imul(i + 1, 2654435761) + players * 1009) >>> 0;
        const result = run(players, seed, skill);
        times.push(result.virtualMs);
        summary.terminated++;
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
        summary.strengths[skill]!.kicks += result.kicks;
        summary.strengths[skill]!.goals += result.goals;
        result.directions.forEach((direction) => directions.add(direction));
      }
      times.sort((a, b) => a - b);
      summary.medianMs = (times[499]! + times[500]!) / 2;
      summary.minMs = times[0]!;
      summary.maxMs = times.at(-1)!;
      expect(summary.terminated).toBe(1000);
      expect(summary.minMs).toBe(188_000);
      expect(summary.maxMs).toBe(188_000);
      expect(summary.maxMs).toBeLessThan(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(summary.physicsSteps).toBeGreaterThan(1000);
      expect(summary.kicks).toBeGreaterThan(0);
      expect(summary.goals).toBeGreaterThan(0);
      expect(summary.release).toBeGreaterThan(0);
      expect(directions.size).toBeGreaterThan(3);
      for (const value of Object.values(summary.strengths)) {
        expect(value.games).toBeGreaterThanOrEqual(333);
        expect(value.kicks).toBeGreaterThan(0);
      }
      summaries.push(summary);
      console.log(JSON.stringify(summary));
      if (process.env['PB_WRITE_EVIDENCE'] === '1') {
        const folder = fileURLToPath(new URL('../../../jobs/P24-haxball/media/', import.meta.url));
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          `${folder}/simulation.json`,
          `${JSON.stringify(
            {
              seedScheme: '(i+1)*2654435761 + players*1009, uint32',
              gameCount: summaries.reduce((total, item) => total + item.games, 0),
              defaultHalves: '2 x90 seconds',
              physicsStepMs: STEP_MS,
              strategyCoverage:
                'Movement/directions, accepted kick and release metrics; game.test pins striker/defender/support decisions',
              counts: [...summaries].sort((a, b) => a.players - b.players),
            },
            null,
            2,
          )}\n`,
          'utf8',
        );
      }
    },
    300_000,
  );
});
