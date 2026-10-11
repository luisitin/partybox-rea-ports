// One process; no browser. Bots at simultaneous 100 ms beats rather than serial fake time.
import { writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { makePlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/colour-gate/server/index.ts';
import type { State } from '../../../games/colour-gate/server/types.ts';

export const T0 = 1_700_000_000_000;
export function start(count: number, seed: number, rounds = 3): State {
  return game.init({
    players: makePlayers(count).map((p) => ({ ...p, bot: true })),
    seed,
    settings: { rounds },
    now: T0,
  });
}
export function beat(
  state: State,
  rng: ReturnType<typeof createRng>,
  skill: BotSkill = 'normal',
): State {
  const { phase } = state;
  if (phase.deadline === null) throw new Error(`Missing deadline in ${phase.id}`);
  const now = phase.deadline;
  let next = game.reduce(state, {
    type: 'timer',
    phaseId: phase.id,
    startedAt: phase.startedAt,
    now,
  });
  if (next.phase.id === 'play') {
    for (const id of Object.keys(next.players)) {
      const input = game.bot.sampleInput(next, id, rng, skill);
      if (input === null) continue;
      if (!game.inputSchema.safeParse(input).success)
        throw new Error(`Invalid bot input for ${id}`);
      next = game.reduce(next, { type: 'input', now, playerId: id, input });
    }
  }
  return next;
}

export function simulate(count: number, seed: number, skill: BotSkill = 'normal') {
  const rng = createRng(seed);
  let state = start(count, seed);
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  const lengths: number[] = [];
  let gates = 0;
  let crashes = 0;
  let maxEventTime = T0;
  for (let steps = 0; state.phase.id !== 'done'; steps++) {
    if (steps > 4000 || state.phase.deadline === null || state.phase.deadline - T0 > budget)
      throw new Error(`Stuck: players=${count} seed=${seed} phase=${state.phase.id}`);
    const previous = state;
    maxEventTime = state.phase.deadline;
    state = beat(state, rng, skill);
    if (state.phase.id === 'score' && previous.phase.id === 'play') {
      lengths.push(state.phase.startedAt - previous.began);
      gates += state.world.runners.reduce((sum, r) => sum + r.gates, 0);
      crashes += state.world.runners.reduce((sum, r) => sum + r.crashes, 0);
    }
    if (state === previous) throw new Error(`Reducer did not advance its beat: ${seed}`);
  }
  const result = game.results(state);
  if (!result || result.ranking.length !== count || lengths.length !== state.settings.rounds)
    throw new Error(`Incomplete final result: ${count}/${seed}`);
  return {
    lengths,
    duration: maxEventTime - T0,
    gates,
    crashes,
    scores: Object.values(result.scores),
  };
}

if (process.argv[1]?.endsWith('sim.mts')) {
  const countArg = process.argv.indexOf('--games');
  const runs = countArg >= 0 ? Number(process.argv[countArg + 1]) : 1000;
  const skillArg = process.argv.indexOf('--skill');
  const skill = (skillArg >= 0 ? process.argv[skillArg + 1] : 'normal') as BotSkill;
  if (!Number.isInteger(runs) || runs < 1 || !['easy', 'normal', 'sharp'].includes(skill))
    throw new Error('Invalid arguments');
  const output = [];
  for (let count = 2; count <= 8; count++) {
    const lengths: number[] = [];
    let durationMax = 0,
      gatesTotal = 0,
      crashesTotal = 0,
      scoreTotal = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const result = simulate(count, seed, skill);
      lengths.push(...result.lengths);
      durationMax = Math.max(durationMax, result.duration);
      gatesTotal += result.gates;
      crashesTotal += result.crashes;
      scoreTotal += result.scores.reduce((sum, score) => sum + score, 0);
    }
    lengths.sort((a, b) => a - b);
    const mid = Math.floor(lengths.length / 2);
    const row = {
      players: count,
      games: runs,
      rounds: lengths.length,
      skill,
      medianRoundMs: lengths.length % 2 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2,
      maxRoundMs: lengths.at(-1),
      maxMatchMs: durationMax,
      meanGatesPerPlayerRound: gatesTotal / (runs * count * 3),
      meanCrashesPerPlayerRound: crashesTotal / (runs * count * 3),
      meanScorePerPlayerMatch: scoreTotal / (runs * count),
    };
    output.push(row);
    console.log(JSON.stringify(row));
  }
  writeFileSync(
    new URL(`sim-results-${skill}.json`, import.meta.url),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );
  // All work and output are synchronous and complete; do not leave TS loader handles on Windows.
  process.exit(0);
}
