// Colour Gate: pure simultaneous lane racing with checkpoint retries and a public course.
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
import type { ControllerView, GameDefinition, InitContext, TvView } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES } from './types';
import type { Input, Runner, State, World } from './types';
import { inputSchema } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
interface MatchView {
  botIds: string[];
  world: World;
  began: number;
  endsAt: number;
  round: number;
  rounds: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}
export interface ColourGateTvView extends TvView, MatchView {}
export interface ColourGateControllerView extends ControllerView, MatchView {
  runner: Runner | null;
  rank: number | null;
  phoneStage: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const state: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    rng: seedRng(ctx.seed),
    players,
    world: { runners: [], gates: [], checked: 0 },
    began: ctx.now,
    endsAt: ctx.now,
    round: 1,
    settings: { rounds: numberSetting(manifest, ctx.settings, 'rounds') },
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    lastPoints: {},
    phoneOnly: ctx.presence?.phoneOnly === true,
  };
  return enterPlay(state, ctx.now);
}
const advance = (state: State, now: number): State => {
  if (state.phase.id === 'play') return advancePlay(state, now, enterScore);
  if (state.phase.id === 'score')
    return state.round >= state.settings.rounds
      ? enterDone(state, now)
      : enterPlay(state, now, state.round + 1);
  return state;
};
const composedReduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? enterScore(settle(state, now), now) : advance(state, now),
  end: (state, now) =>
    enterDone(
      state.phase.id === 'play'
        ? enterScore(settle(state, state.phase.paused?.at ?? now), now)
        : state,
      now,
    ),
  prepare: (state, event) => {
    if (
      event.type === 'vip' &&
      event.action === 'pause' &&
      !state.phase.paused &&
      state.phase.id === 'play'
    )
      return settle(state, event.now);
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'play')
      return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms, endsAt: state.endsAt + ms } : state;
  },
});
function reduce(state: State, event: Parameters<typeof composedReduce>[1]): State {
  const earliest = Math.max(
    state.phase.startedAt,
    state.phase.paused?.at ?? 0,
    state.phase.id === 'play' ? state.began + state.world.checked : 0,
  );
  return event.type === 'vip' && event.now < earliest ? state : composedReduce(state, event);
}
const statusOf =
  (state: State) =>
  (id: string): 'active' | 'waiting' =>
    state.phase.id === 'play' &&
    state.world.runners.some((r) => r.id === id && r.respawnAt === null)
      ? 'active'
      : 'waiting';
const matchView = (state: State): MatchView => ({
  botIds: Object.values(state.players)
    .filter((p) => p.bot)
    .map((p) => p.id),
  world: state.world,
  began: state.began,
  endsAt: state.endsAt,
  round: state.round,
  rounds: state.settings.rounds,
  scores: state.scores,
  lastPoints: state.lastPoints,
});
function tvView(state: State): ColourGateTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    timerMode: 'hidden',
  };
}
function controllerView(state: State, id: string): ColourGateControllerView {
  const mine = hasPlayer(state, id);
  const score = mine ? (state.scores[id] ?? 0) : 0;
  return {
    ...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    runner: mine ? (state.world.runners.find((r) => r.id === id) ?? null) : null,
    rank:
      mine && state.phase.id === 'done'
        ? 1 + Object.values(state.scores).filter((s) => s > score).length
        : null,
    phoneStage: state.phoneOnly || (mine && state.players[id]?.canSeeTv === false),
  };
}
export const game: GameDefinition<State, Input, ColourGateTvView, ColourGateControllerView> = {
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
