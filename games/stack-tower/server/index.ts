// Skyline Stack: the pure reducer and public TV/phone projections.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  nextInt,
  pausedFor,
  seedRng,
} from '@partybox/game-sdk';
import type {
  ControllerView,
  GameDefinition,
  InitContext,
  PlayerStatus,
  TvView,
} from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { reducePlay } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, ROUND_MS, TICK_MS } from './types';
import type { State, Tower } from './types';
import { inputSchema, makeTower } from './world';
import type { Input } from './world';

const manifest = gameManifestSchema.parse(manifestJson);

interface RaceView {
  slots: Record<string, number>;
  scores: Record<string, number>;
  began: number;
  endsAt: number;
  checked: number;
  course: number;
}

export interface SkylineTvView extends TvView, RaceView {
  towers: Tower[];
}

export interface SkylineControllerView extends ControllerView, RaceView {
  tower: Tower | null;
  towers?: Tower[];
  rank: number | null;
  stage: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const [course, rng] = nextInt(seedRng(ctx.seed), 0, 1);
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    rng,
    players,
    began: ctx.now,
    endsAt: ctx.now + ROUND_MS,
    checked: ctx.now,
    course,
    towers: ctx.players.map((p) => makeTower(p.id, ctx.now)),
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    phoneOnly: ctx.presence?.phoneOnly ?? false,
  };
}

const advance = (state: State, now: number): State =>
  state.phase.id === 'play'
    ? enterScore(state, now)
    : state.phase.id === 'score'
      ? enterDone(state, now)
      : state;

function shift(state: State, ms: number): State {
  if (ms <= 0 || state.phase.id !== 'play') return state;
  return {
    ...state,
    began: state.began + ms,
    endsAt: state.endsAt + ms,
    checked: state.checked + ms,
    towers: state.towers.map((t) => ({
      ...t,
      movingSince: t.movingSince + ms,
      lastAt: t.lastAt + ms,
      crashedAt: t.crashedAt === null ? null : t.crashedAt + ms,
    })),
  };
}

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  end: enterDone,
  prepare: (state, event) =>
    event.type === 'vip' && event.action === 'resume'
      ? shift(state, pausedFor(state, event.now))
      : state,
});

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.towers.some((t) => t.id === id && t.crashedAt === null)
      ? 'active'
      : 'waiting';

const raceView = (state: State): RaceView => ({
  slots: Object.fromEntries(state.towers.map((tower, slot) => [tower.id, slot])),
  scores: state.scores,
  began: state.began,
  endsAt: state.endsAt,
  checked: state.checked,
  course: state.course,
});

const options = (state: State) => ({
  statusOf: statusOf(state),
  deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
  skipLabel: state.phase.id === 'play' ? 'Finish race' : 'Show results',
});

function tvView(state: State): SkylineTvView {
  return {
    ...envelope(state, manifest.id, options(state)),
    ...raceView(state),
    towers: state.towers,
    timerMode: 'hidden',
  };
}

function controllerView(state: State, playerId: string): SkylineControllerView {
  const stage =
    state.phoneOnly || (hasPlayer(state, playerId) && state.players[playerId]?.canSeeTv === false);
  const mine = hasPlayer(state, playerId) ? (state.scores[playerId] ?? 0) : null;
  return {
    ...controllerEnvelope(state, manifest.id, playerId, options(state)),
    ...raceView(state),
    tower: state.towers.find((t) => t.id === playerId) ?? null,
    ...(stage ? { towers: state.towers } : {}),
    stage,
    rank:
      state.phase.id === 'done' && mine !== null
        ? 1 + Object.values(state.scores).filter((n) => n > mine).length
        : null,
  };
}

export const game: GameDefinition<State, Input, SkylineTvView, SkylineControllerView> = {
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
