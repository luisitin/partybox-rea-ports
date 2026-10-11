import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
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
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES } from './types';
import type { State } from './types';
import { createWorld, inputSchema, laneObjectsAt, ROWS, WIDTH } from './world';
import type { Input, Lane, Runner } from './world';

const manifest = gameManifestSchema.parse(manifestJson);

export interface MapView {
  width: number;
  startRow: number;
  endRow: number;
  /** Moving objects already have their positions at checked. No private map data exists. */
  lanes: Lane[];
}

interface MatchView {
  began: number;
  endsAt: number;
  checked: number;
  seconds: number;
  scores: Record<string, number>;
  map: MapView;
  runners: Runner[];
}

export interface CrossyTvView extends TvView, MatchView {}

export interface CrossyControllerView extends ControllerView, MatchView {
  own: Runner | null;
  /** The map is always useful for precision; this records whether the phone is also the stage. */
  phoneStage: boolean;
  rank: number | null;
  tied: boolean;
}

function init(ctx: InitContext): State {
  const players: State['players'] = {};
  const scores: State['scores'] = {};
  for (const player of ctx.players) {
    Object.defineProperty(players, player.id, {
      value: { ...player },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(scores, player.id, {
      value: 0,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  const [world, rng] = createWorld(ctx.players, seedRng(ctx.seed));
  return enterPlay(
    {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      rng,
      players,
      scores,
      world,
      began: ctx.now,
      endsAt: ctx.now + 60_000,
      checked: 0,
      seconds: 60,
      ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
    },
    ctx.now,
  );
}

const advance = (state: State, now: number): State => {
  switch (state.phase.id) {
    case 'play':
      return advancePlay(state, now, enterScore);
    case 'score':
      return enterDone(state, now);
    default:
      return state;
  }
};

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? skipPlay(state, now, enterScore) : advance(state, now),
  end: (state, now) =>
    enterDone(state.phase.id === 'play' && !state.phase.paused ? settle(state, now) : state, now),
  prepare: (state, event) => {
    if (event.type !== 'vip' || state.phase.id !== 'play') return state;
    if (event.action === 'pause' && !state.phase.paused) return settle(state, event.now);
    if (event.action !== 'resume') return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms, endsAt: state.endsAt + ms } : state;
  },
});

function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) =>
    state.phase.id === 'play' &&
    state.world.runners.some((runner) => runner.id === id && runner.alive)
      ? 'active'
      : 'waiting';
}

function mapView(state: State, focus: number): MapView {
  const endRow = Math.min(ROWS - 1, Math.max(10, focus + 5));
  const startRow = Math.max(0, endRow - 10);
  return {
    width: WIDTH,
    startRow,
    endRow,
    lanes: state.world.lanes.slice(startRow, endRow + 1).map((lane) => ({
      ...lane,
      // Publish the full pattern, including objects just outside the clipped viewport.
      // Bot edge predictions then use exactly the traffic available on the phone.
      objects: laneObjectsAt(lane, state.checked, true),
      // Clients render a judged snapshot, so its objects need no further offsets.
      offset: 0,
    })),
  };
}

function matchView(state: State, focus: number): MatchView {
  return {
    began: state.began,
    endsAt: state.endsAt,
    checked: state.checked,
    seconds: state.seconds,
    scores: state.scores,
    map: mapView(state, focus),
    runners: state.world.runners,
  };
}

function leaderRow(state: State): number {
  return Math.max(0, ...state.world.runners.map((runner) => runner.row));
}

function options(state: State) {
  return {
    statusOf: statusOf(state),
    scores: state.scores,
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    skipLabel: state.phase.id === 'play' ? 'Finish race' : 'Show final results',
  };
}

function tvView(state: State): CrossyTvView {
  return {
    ...envelope(state, manifest.id, options(state)),
    timerMode: 'hidden',
    ...matchView(state, leaderRow(state)),
  };
}

function controllerView(state: State, playerId: string): CrossyControllerView {
  const own = state.world.runners.find((runner) => runner.id === playerId) ?? null;
  const over = state.phase.id !== 'play' && hasPlayer(state, playerId);
  const score = hasPlayer(state, playerId) ? (state.scores[playerId] ?? 0) : 0;
  return {
    ...controllerEnvelope(state, manifest.id, playerId, options(state)),
    ...matchView(state, own?.row ?? leaderRow(state)),
    own,
    phoneStage:
      state.phoneOnly === true ||
      (hasPlayer(state, playerId) && state.players[playerId]?.canSeeTv === false),
    rank: over ? 1 + Object.values(state.scores).filter((value) => value > score).length : null,
    tied:
      over &&
      Object.entries(state.scores).some(([id, value]) => id !== playerId && value === score),
  };
}

export const game: GameDefinition<State, Input, CrossyTvView, CrossyControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: {
    sampleInput(state, playerId, rng, skill) {
      if (
        state.phase.id !== 'play' ||
        state.phase.paused ||
        !hasPlayer(state, playerId) ||
        !state.players[playerId]?.connected
      )
        return null;
      return botInput(state.world, playerId, rng, skill);
    },
  },
};
