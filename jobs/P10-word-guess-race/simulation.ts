import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BOT_SKILLS, createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent } from '@partybox/game-sdk';
import { defaultSettingsOf, fnv1a, hashState, T0, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/word-guess-race/server/index';
import type { Input, State } from '../../games/word-guess-race/server/types';

export interface Simulation {
  finalState: State;
  gameMs: number;
  roundMs: number[];
  events: number;
  solved: number;
}

/** Same public inputs/timers as the host, with a separate seeded RNG for bot choices. */
export function simulate(
  players: number,
  seed: number,
  skill: BotSkill,
  onState?: (state: State, event?: GameEvent<Input>) => void,
): Simulation {
  const roster = testPlayers(players, { bots: players });
  const rng = createRng(seed ^ 0x514a);
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  let state = game.init({
    players: roster,
    seed,
    now: T0,
    settings: defaultSettingsOf(game),
    ...(skill !== 'normal' ? { botSkill: skill } : {}),
  });
  let now = T0;
  let events = 0;
  let solved = 0;
  const roundMs: number[] = [];
  onState?.(state);
  const apply = (event: GameEvent<Input>): void => {
    const before = state;
    state = game.reduce(state, event);
    events += 1;
    if (before.phase.id === 'guess' && state.phase.id !== 'guess') {
      roundMs.push(event.now - before.phase.startedAt);
      solved += Object.values(state.entries).filter((e) => e.solvedElapsedMs !== null).length;
    }
    onState?.(state, event);
  };
  while (game.results(state) === null) {
    if (now - T0 > budget || events > 10_000)
      throw new Error(`Did not terminate: players=${players} skill=${skill} seed=${seed}`);
    let acted = false;
    const phaseKey = `${state.phase.id}:${state.phase.startedAt}`;
    for (const player of rng.shuffle(roster)) {
      if (game.results(state) !== null) break;
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(`Invalid bot input: ${players}/${skill}/${seed}: ${JSON.stringify(input)}`);
      const nextNow = now + rng.int(700, 2500);
      const deadline = state.phase.deadline;
      if (deadline !== null && nextNow >= deadline) break;
      now = nextNow;
      apply({ type: 'input', playerId: player.id, input: parsed.data, now });
      acted = true;
      if (`${state.phase.id}:${state.phase.startedAt}` !== phaseKey) break;
    }
    if (game.results(state) !== null) break;
    if (acted) continue;
    const { phase } = state;
    if (phase.deadline === null || phase.paused)
      throw new Error(`No legal action or timer: ${players}/${skill}/${seed}/${phase.id}`);
    now = Math.max(now, phase.deadline);
    const before = state;
    apply({ type: 'timer', now, phaseId: phase.id, startedAt: phase.startedAt });
    if (state === before) throw new Error(`Timer refused: ${players}/${skill}/${seed}/${phase.id}`);
  }
  if (roundMs.length !== 3)
    throw new Error(`Wrong round count: ${players}/${skill}/${seed}/${roundMs.length}`);
  if (now - T0 > budget)
    throw new Error(`Over manifest budget: ${players}/${skill}/${seed}/${now - T0}`);
  return { finalState: state, gameMs: now - T0, roundMs, events, solved };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const runs = Number(process.argv[2] ?? 1000);
  if (!Number.isInteger(runs) || runs < 1) throw new Error('Runs must be a positive integer');
  const groups = [];
  for (let players = 2; players <= 8; players++) {
    for (const skill of BOT_SKILLS) {
      process.stderr.write(`Starting ${runs} seeds: ${players} players / ${skill}\n`);
      const rounds: number[] = [];
      const times: number[] = [];
      let solved = 0;
      let maxEvents = 0;
      let digest = '';
      for (let seed = 1; seed <= runs; seed++) {
        const result = simulate(players, seed, skill);
        rounds.push(...result.roundMs);
        times.push(result.gameMs);
        solved += result.solved;
        maxEvents = Math.max(maxEvents, result.events);
        digest = fnv1a(`${digest}:${hashState(result.finalState)}:${result.gameMs}`);
      }
      groups.push({
        players,
        skill,
        runs,
        seeds: [1, runs],
        terminated: runs,
        medianRoundMs: median(rounds),
        medianGameMs: median(times),
        maxGameMs: Math.max(...times),
        solvedFraction: solved / (runs * players * 3),
        maxEvents,
        finalStatesDigest: digest,
      });
      process.stderr.write(
        `Finished ${players}/${skill}: ${runs} terminated; median round ${median(rounds)}ms; max game ${Math.max(...times)}ms\n`,
      );
    }
  }
  const report = {
    game: game.manifest.id,
    totalGames: groups.length * runs,
    budgetMs: game.manifest.estimatedMinutes * 2 * 60_000,
    deterministic:
      'Seeds 1..runs; public bot inputs, seeded seating order and timing; no VIP skips',
    groups,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const path = process.argv[3];
  if (path) writeFileSync(path, output, 'utf8');
  process.stdout.write(output);
}
