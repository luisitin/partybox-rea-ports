import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  onPlayerEvent,
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
import { advancePlay, enterPlay, reducePlay, settle, skipPlay } from './phases/play';
import { enterReady, reduceReady } from './phases/ready';
import { enterScore, reduceScore } from './phases/score';
import { areaScores, results } from './scoring';
import { PHASES, TICK_MS } from './types';
import type { Direction, Input, Runner, State } from './types';
import { createWorld, inputSchema, removeRunner } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
export interface PublicRunner extends Omit<Runner, 'respawnTick' | 'queued'> {
  respawnAt: number | null;
  movingDir: Direction;
}
interface MatchView {
  width: number;
  height: number;
  began: number;
  endsAt: number;
  checked: number;
  scores: Record<string, number>;
  runners: PublicRunner[];
}
export interface PaperTerritoryTvView extends TvView, MatchView {
  owners: number[];
}
export interface PaperTerritoryControllerView extends ControllerView, MatchView {
  owners?: number[];
  slot: number;
  area: number;
  alive: boolean;
  dir: Direction;
  movingDir: Direction;
  deaths: number;
  captures: number;
  lastCapture: number;
  cause: Runner['cause'];
  respawnAt: number | null;
  rank: number | null;
  tied: boolean;
}
function init(ctx: InitContext): State {
  const world = createWorld(ctx.players);
  return enterReady(
    {
      phase: { id: 'ready', startedAt: ctx.now, deadline: null },
      rng: seedRng(ctx.seed),
      players: Object.fromEntries(ctx.players.map((p) => [p.id, p])),
      world,
      began: ctx.now,
      endsAt: ctx.now,
      checked: 0,
      scores: areaScores(world),
      left: [],
      phoneOnly: ctx.presence?.phoneOnly === true,
    },
    ctx.now,
  );
}
const advance = (state: State, now: number): State => {
  switch (state.phase.id) {
    case 'ready':
      return enterPlay(state, now);
    case 'play':
      return advancePlay(state, now, enterScore);
    case 'score':
      return enterDone(state, now);
    default:
      return state;
  }
};
const reduce = composeReduce<State, Input>({
  phases: { ready: reduceReady, play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? skipPlay(state, now, enterScore) : advance(state, now),
  end: (state, now) =>
    enterDone(state.phase.id === 'play' && !state.phase.paused ? settle(state, now) : state, now),
  prepare: (state, event) => {
    if (event.type !== 'vip' || state.phase.id !== 'play') return state;
    if (event.action === 'pause' && !state.phase.paused)
      return advancePlay(state, event.now, enterScore);
    if (event.action === 'resume')
      return {
        ...state,
        began: state.began + pausedFor(state, event.now),
        endsAt: state.endsAt + pausedFor(state, event.now),
      };
    return state;
  },
  onPlayer: (state, event) => {
    if (!hasPlayer(state, event.playerId)) return state;
    const base =
      state.phase.id === 'play' && !state.phase.paused
        ? advancePlay(state, event.now, enterScore)
        : state;
    const changed = onPlayerEvent(base, event);
    if (changed === base || (changed.phase.id !== 'ready' && changed.phase.id !== 'play'))
      return changed;
    const runner = changed.world.runners.find((r) => r.id === event.playerId);
    if (!runner) return changed;
    if (event.gone || !event.connected)
      return {
        ...changed,
        world: removeRunner(changed.world, runner.slot, 'connection', !!event.gone),
      };
    if (!runner.alive && runner.respawnTick === null && !changed.left.includes(runner.id))
      return {
        ...changed,
        world: {
          ...changed.world,
          runners: changed.world.runners.map((r) =>
            r.id === runner.id ? { ...r, respawnTick: changed.world.stepped + 1 } : r,
          ),
        },
      };
    return changed;
  },
});
const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.world.runners.some((r) => r.id === id && r.alive)
      ? 'active'
      : 'waiting';
const roundEnds = (state: State): number | null =>
  state.phase.id === 'play' ? state.endsAt : state.phase.deadline;
function matchView(state: State): MatchView {
  return {
    width: state.world.width,
    height: state.world.height,
    began: state.began,
    endsAt: state.endsAt,
    checked: state.checked,
    scores:
      state.phase.id === 'ready' || state.phase.id === 'play'
        ? areaScores(state.world)
        : state.scores,
    runners: state.world.runners.map(({ respawnTick, queued, ...r }) => ({
      ...r,
      dir: queued,
      movingDir: r.dir,
      respawnAt: respawnTick === null ? null : state.began + respawnTick * TICK_MS,
    })),
  };
}
function tvView(state: State): PaperTerritoryTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: roundEnds(state),
    timerMode: 'quiet',
    owners: state.world.owners,
  };
}
function controllerView(state: State, playerId: string): PaperTerritoryControllerView {
  const runner = state.world.runners.find((r) => r.id === playerId);
  const view = matchView(state);
  const stage =
    state.phoneOnly || !hasPlayer(state, playerId) || state.players[playerId]?.canSeeTv === false;
  const over = state.phase.id === 'done' && hasPlayer(state, playerId);
  const score = view.scores[playerId] ?? 0;
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    ...view,
    deadline: roundEnds(state),
    ...(stage ? { owners: state.world.owners } : {}),
    slot: runner?.slot ?? -1,
    area: runner?.area ?? 0,
    alive: runner?.alive ?? false,
    dir: runner?.queued ?? 0,
    movingDir: runner?.dir ?? 0,
    deaths: runner?.deaths ?? 0,
    captures: runner?.captures ?? 0,
    lastCapture: runner?.lastCapture ?? 0,
    cause: runner?.cause ?? null,
    respawnAt: runner?.respawnTick == null ? null : state.began + runner.respawnTick * TICK_MS,
    rank: over ? 1 + Object.values(view.scores).filter((s) => s > score).length : null,
    tied: over && Object.entries(view.scores).some(([id, s]) => id !== playerId && s === score),
  };
}
export const game: GameDefinition<
  State,
  Input,
  PaperTerritoryTvView,
  PaperTerritoryControllerView
> = {
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
