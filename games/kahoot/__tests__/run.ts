// Test-only seeded bots use the real reducer and its authoritative deadlines.
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

export type RunMode = 'wager' | 'classic';
export const T0 = 1_000_000;
export interface RunResult {
  state: State;
  elapsed: number;
  rounds: number[];
  events: number;
}

export function simulate(
  count: number,
  seed: number,
  mode: RunMode,
  skill: BotSkill,
  settings: Record<string, string | number | boolean> = {},
): RunResult {
  // Bot/scheduling RNG is external to game state, as in the host's bot runner.
  const rng = createRng(seed ^ 0x514a8);
  let state = game.init({
    players: testPlayers(count, { bots: count }),
    settings: {
      quizMode: mode,
      classicPack: (['general', 'movies', 'science'] as const)[(seed - 1) % 3]!,
      ...settings,
    },
    seed,
    now: T0,
    contentLang: mode === 'wager' && seed % 4 === 0 ? 'es' : 'en',
    presence: { mode: 'together', phoneOnly: seed % 3 === 0 },
  });
  let now = T0;
  let events = 0;
  const rounds: number[] = [];
  const reduce = (input: Input | null, playerId?: string): void => {
    const before = state;
    events++;
    state =
      input && playerId
        ? game.reduce(state, { type: 'input', playerId, input, now })
        : game.reduce(state, {
            type: 'timer',
            now,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt,
          });
    if (before.phase.id === 'question' && state.phase.id === 'reveal') {
      // A round is its answer window actually used plus the automatic reveal/standings beat.
      rounds.push(now - before.phase.startedAt + Math.max(0, (state.phase.deadline ?? now) - now));
    }
  };
  for (let turn = 0; turn < 1000 && state.phase.id !== 'done'; turn++) {
    const phase = state.phase.id;
    const startedAt = state.phase.startedAt;
    const deadline = state.phase.deadline;
    if (deadline === null || !Number.isFinite(deadline))
      throw new Error(`No finite deadline in ${phase}, ${mode}, ${count} seats, seed ${seed}`);
    if (phase === 'question' || phase === 'wager') {
      for (const player of rng.shuffle(Object.values(state.players))) {
        if (!player.connected) continue;
        if (state.phase.id !== phase || state.phase.startedAt !== startedAt) break;
        now = Math.min(deadline, Math.max(now, startedAt) + rng.int(200, 950));
        if (now >= deadline) break;
        const input = game.bot.sampleInput(state, player.id, rng, skill);
        if (!input) continue;
        if (!game.inputSchema.safeParse(input).success)
          throw new Error(`Invalid ${mode} bot input at seed ${seed}`);
        reduce(input, player.id);
      }
      if (state.phase.id !== phase || state.phase.startedAt !== startedAt) continue;
    }
    now = Math.max(now, deadline);
    reduce(null);
  }
  if (state.phase.id !== 'done')
    throw new Error(`Did not terminate: ${mode}, ${count} seats, seed ${seed}`);
  return { state, elapsed: now - T0, rounds, events };
}
