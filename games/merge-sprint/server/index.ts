// Merge Sprint is a deterministic same-seed race. The SDK owns event ordering and pause.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  pausedFor,
  seedRng,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { spawn } from './board';
import { botInput } from './bot';
import { spawnStream } from './content';
import { enterDone } from './phases/done';
import { reducePlay } from './phases/play';
import { enterReveal, reduceReveal } from './phases/reveal';
import { compareRacers, results, winners } from './scoring';
import { MOVE_MS, PHASES, TARGET, inputSchema } from './types';
import type { ControllerMergeView, Input, RaceView, RacerView, State, TvMergeView } from './types';
export type { ControllerMergeView, TvMergeView } from './types';

const manifest = gameManifestSchema.parse(manifestJson);

function init(ctx: InitContext): State {
  const [spawns, rng] = spawnStream(seedRng(ctx.seed));
  const board = spawn(spawn(Array<number>(16).fill(0), spawns[0]!), spawns[1]!);
  const seconds = numberSetting(manifest, ctx.settings, 'seconds');
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + seconds * 1000 },
    rng,
    players: Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }])),
    racers: Object.fromEntries(
      ctx.players.map((p) => [
        p.id,
        {
          board: [...board],
          score: 0,
          moves: 0,
          lastAt: ctx.now - MOVE_MS,
          status: 'racing' as const,
        },
      ]),
    ),
    spawns,
    settings: { seconds },
    phoneOnly: ctx.presence?.phoneOnly ?? false,
    reason: null,
  };
}

function advance(state: State, now: number): State {
  if (state.phase.id === 'play') return enterReveal(state, now);
  if (state.phase.id === 'reveal') return enterDone(state, now);
  return state;
}

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, reveal: reduceReveal },
  advance,
  end: enterDone,
  prepare: (state, event) => {
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'play')
      return state;
    const ms = pausedFor(state, event.now);
    return ms <= 0
      ? state
      : {
          ...state,
          racers: Object.fromEntries(
            Object.entries(state.racers).map(([id, r]) => [id, { ...r, lastAt: r.lastAt + ms }]),
          ),
        };
  },
});

function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) =>
    state.phase.id === 'play' && state.racers[id]?.status === 'racing' ? 'active' : 'waiting';
}

function raceView(state: State): RaceView {
  const racers: RacerView[] = Object.entries(state.racers).map(([id, r]) => ({
    id,
    board: r.board,
    score: r.score,
    best: Math.max(...r.board),
    moves: r.moves,
    status: r.status,
    rank: 1 + Object.values(state.racers).filter((other) => compareRacers(other, r) < 0).length,
  }));
  return {
    racers,
    winners: state.phase.id === 'play' ? [] : winners(state),
    reason: state.reason,
    target: TARGET,
  };
}

function tvView(state: State): TvMergeView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    timerMode: 'hidden',
    ...raceView(state),
  };
}

function controllerView(state: State, playerId: string): ControllerMergeView {
  const race = raceView(state);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    ...race,
    mine: hasPlayer(state, playerId) ? (race.racers.find((r) => r.id === playerId) ?? null) : null,
  };
}

export const game: GameDefinition<State, Input, TvMergeView, ControllerMergeView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: { sampleInput: botInput },
};
