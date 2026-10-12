// Group matches use the canonical reducer; a round includes its entire talk, answer and reveal.
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { CLASSIC_PACK_IDS } from '../content/classic-schema';
import { game } from '../server/index';
import type { GroupMode, Input, State } from '../server/types';
import { T0 } from './run';

export interface GroupRunResult {
  state: State;
  elapsed: number;
  rounds: number[];
  events: number;
  maxStateBytes: number;
}

export function simulateGroup(
  count: number,
  seed: number,
  mode: GroupMode,
  skill: BotSkill,
  settings: Record<string, string | number | boolean> = {},
): GroupRunResult {
  const rng = createRng(seed ^ 0x503032);
  let state = game.init({
    players: testPlayers(count, { bots: count }),
    settings: {
      quizMode: mode,
      classicPack: CLASSIC_PACK_IDS[(seed - 1) % CLASSIC_PACK_IDS.length]!,
      ...settings,
    },
    seed,
    now: T0,
    presence: { mode: 'together', phoneOnly: seed % 3 === 0 },
  });
  let now = T0;
  let events = 0;
  let roundStartedAt: number | undefined;
  let maxStateBytes = Buffer.byteLength(JSON.stringify(state), 'utf8');
  const rounds: number[] = [];
  const reduce = (input: Input | null, playerId?: string): void => {
    const before = state;
    state =
      input && playerId
        ? game.reduce(state, { type: 'input', playerId, input, now })
        : game.reduce(state, {
            type: 'timer',
            now,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt,
          });
    events++;
    maxStateBytes = Math.max(maxStateBytes, Buffer.byteLength(JSON.stringify(state), 'utf8'));
    if (before.phase.id === 'reveal' && state.phase.id !== 'reveal') {
      if (roundStartedAt === undefined) throw new Error('Group round must start before its reveal');
      rounds.push(now - roundStartedAt);
      roundStartedAt = undefined;
    }
    if (state.phase.id === 'talk' && before.phase.id !== 'talk')
      roundStartedAt = state.phase.startedAt;
    if (state.phase.id === 'question' && roundStartedAt === undefined)
      roundStartedAt = state.phase.startedAt;
  };
  for (let turn = 0; turn < 1000 && state.phase.id !== 'done'; turn++) {
    const { id: phase, startedAt, deadline } = state.phase;
    if (deadline === null || !Number.isFinite(deadline))
      throw new Error(`No finite ${mode} deadline: ${count} players, seed ${seed}, phase ${phase}`);
    if (phase === 'question') {
      for (const player of rng.shuffle(Object.values(state.players))) {
        if (!player.connected) continue;
        if (state.phase.id !== phase || state.phase.startedAt !== startedAt) break;
        now = Math.min(deadline, Math.max(now, startedAt) + rng.int(200, 950));
        if (now >= deadline) break;
        const input = game.bot.sampleInput(state, player.id, rng, skill);
        if (input === null) continue;
        if (!game.inputSchema.safeParse(input).success)
          throw new Error(`Invalid ${skill} group bot input: ${mode}, seed ${seed}`);
        reduce(input, player.id);
      }
      if (state.phase.id !== phase || state.phase.startedAt !== startedAt) continue;
    }
    // All-answered reading holds may shorten the authoritative deadline during this pass.
    now = Math.max(now, state.phase.deadline ?? deadline);
    reduce(null);
  }
  if (state.phase.id !== 'done')
    throw new Error(`Group match did not terminate: ${mode}, ${count} players, seed ${seed}`);
  return { state, elapsed: now - T0, rounds, events, maxStateBytes };
}
