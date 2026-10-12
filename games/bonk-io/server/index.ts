import {
  compareCodeUnits,
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  nextInt,
  onPlayerEvent,
  pausedFor,
  seedRng,
} from '@partybox/game-sdk';
import type {
  ControllerView,
  GameDefinition,
  InitContext,
  PlayerEvent,
  PlayerStatus,
  TvView,
} from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, over, reducePlay, settle, skipPlay } from './phases/play';
import { enterReady, reduceReady } from './phases/ready';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, ROUNDS } from './types';
import type { Ball, Input, Platform, RoundOutcome, State } from './types';
import {
  H,
  ROUND_MS,
  SHRINK_MS,
  W,
  aliveCount,
  depart,
  inputSchema,
  platformsAt,
  release,
} from './world';

export type { Ball, Input, Platform, State } from './types';
const manifest = gameManifestSchema.parse(manifestJson);

interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  checked: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  lastWinners: string[];
  roundOutcome: RoundOutcome;
  aliveCount: number;
  total: number;
  platforms: Platform[];
  arenaWidth: number;
  arenaHeight: number;
  hazard: boolean;
}
export interface BonkTvView extends TvView, MatchView {
  balls: Ball[];
}
export interface BonkControllerView extends ControllerView, MatchView {
  balls?: Ball[];
  slot: number;
  alive: boolean;
  heavy: boolean;
  move: number;
  grounded: boolean;
  departed: boolean;
  rank: number | null;
  tied: boolean;
  cause: Ball['cause'];
}

function init(ctx: InitContext): State {
  const players: State['players'] = {};
  const scores: State['scores'] = {};
  for (const player of [...ctx.players].sort((a, b) => compareCodeUnits(a.id, b.id))) {
    players[player.id] = { ...player };
    scores[player.id] = 0;
  }
  const [spawnOffset, rng] = nextInt(seedRng(ctx.seed), 0, Math.max(0, ctx.players.length - 1));
  const state: State = {
    phase: { id: 'ready', startedAt: ctx.now, deadline: null },
    rng,
    players,
    scores,
    began: ctx.now,
    endsAt: ctx.now,
    checked: 0,
    world: { balls: [], stepped: 0, layout: 0 },
    round: 1,
    rounds: ROUNDS,
    lastPoints: {},
    lastWinners: [],
    roundOutcome: null,
    left: [],
    spawnOffset,
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  return enterReady(state, ctx.now, 1);
}

const afterScore = (state: State, now: number): State =>
  state.round >= state.rounds ? enterDone(state, now) : enterReady(state, now, state.round + 1);

const advance = (state: State, now: number): State => {
  switch (state.phase.id) {
    case 'ready':
      return enterPlay(state, now);
    case 'play':
      return advancePlay(state, now, enterScore);
    case 'score':
      return afterScore(state, now);
    default:
      return state;
  }
};

/** A lifecycle release uses active time, never wall time accumulated during a pause. */
const releaseTime = (state: State, now: number): number | undefined =>
  state.phase.id === 'play'
    ? Math.max(0, Math.min(ROUND_MS, (state.phase.paused?.at ?? now) - state.began))
    : undefined;

/** Judge the old controls first. A departure is permanent even after misleading reconnect/drop churn. */
function onPlayer(state: State, event: PlayerEvent): State {
  if (!hasPlayer(state, event.playerId)) return state;
  let judged = event.now >= state.began + state.checked ? settle(state, event.now) : state;
  if (judged.phase.id === 'play' && !judged.phase.paused && over(judged))
    judged = enterScore(judged, event.now);
  let changed = onPlayerEvent(judged, event);
  const permanent = !!event.gone || changed.left.includes(event.playerId);
  if (permanent && changed.players[event.playerId]?.connected)
    changed = {
      ...changed,
      players: {
        ...changed.players,
        [event.playerId]: { ...changed.players[event.playerId]!, connected: false },
      },
    };
  const world = permanent
    ? release(
        depart(changed.world, event.playerId, changed.checked),
        event.playerId,
        releaseTime(changed, event.now),
      )
    : !event.connected
      ? release(changed.world, event.playerId, releaseTime(changed, event.now))
      : changed.world;
  if (world !== changed.world) changed = { ...changed, world };
  return changed.phase.id === 'play' && !changed.phase.paused && over(changed)
    ? enterScore(changed, event.now)
    : changed;
}

const composed = composeReduce<State, Input>({
  phases: { ready: reduceReady, play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? skipPlay(state, now, enterScore) : advance(state, now),
  end: enterDone,
  onPlayer,
  prepare(state, event) {
    if (event.type !== 'vip') return state;
    if (event.action === 'resume') {
      const shift = pausedFor(state, event.now);
      return shift && state.phase.id === 'play'
        ? { ...state, began: state.began + shift, endsAt: state.endsAt + shift }
        : state;
    }
    if (event.action === 'pause' && !state.phase.paused) {
      const judged = settle(state, event.now);
      const next =
        judged.phase.id === 'play' && over(judged) ? enterScore(judged, event.now) : judged;
      return { ...next, world: release(next.world, undefined, releaseTime(next, event.now)) };
    }
    return state;
  },
  afterVip(_before, after, event) {
    return event.type === 'vip' &&
      event.action === 'resume' &&
      after.phase.id === 'play' &&
      over(after)
      ? enterScore(after, event.now)
      : after;
  },
});

// The socket validates inputs too. Keep the pure game boundary total for saved traces and contract fuzz.
const reduce: typeof composed = (state, event) =>
  event.type === 'input' && !inputSchema.safeParse(event.input).success
    ? state
    : composed(state, event);

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.world.balls.some((b) => b.id === id && b.alive)
      ? 'active'
      : 'waiting';

const matchView = (state: State): MatchView => ({
  round: state.round,
  rounds: state.rounds,
  began: state.began,
  endsAt: state.endsAt,
  checked: state.checked,
  scores: state.scores,
  lastPoints: state.lastPoints,
  lastWinners: state.lastWinners,
  roundOutcome: state.roundOutcome,
  aliveCount: aliveCount(state.world),
  total: state.world.balls.length,
  platforms: platformsAt(state.world.layout, state.checked),
  arenaWidth: W,
  arenaHeight: H,
  hazard: state.checked >= SHRINK_MS,
});
const deadline = (state: State): number | null =>
  state.phase.id === 'play' ? state.endsAt : state.phase.deadline;

function tvView(state: State): BonkTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state), scores: state.scores }),
    deadline: deadline(state),
    timerMode: 'hidden',
    ...matchView(state),
    balls: state.world.balls,
  };
}
function controllerView(state: State, playerId: string): BonkControllerView {
  const player = hasPlayer(state, playerId) ? state.players[playerId] : undefined;
  const ball = state.world.balls.find((b) => b.id === playerId);
  const departed = state.left.includes(playerId);
  const mine = state.scores[playerId] ?? 0;
  const over = state.phase.id === 'done' && !!player;
  const stage =
    state.phoneOnly ||
    player?.canSeeTv === false ||
    !player ||
    departed ||
    state.phase.id === 'score' ||
    state.phase.id === 'done';
  return {
    ...controllerEnvelope(state, manifest.id, playerId, {
      statusOf: statusOf(state),
      scores: state.scores,
    }),
    deadline: deadline(state),
    timerMode: 'hidden',
    ...matchView(state),
    ...(stage ? { balls: state.world.balls } : {}),
    slot: ball?.slot ?? -1,
    alive: ball?.alive ?? false,
    heavy: ball?.heavy ?? false,
    move: ball?.move ?? 0,
    grounded: ball?.grounded ?? false,
    departed,
    cause: ball?.cause ?? null,
    rank: over ? 1 + Object.values(state.scores).filter((score) => score > mine).length : null,
    tied:
      over && Object.entries(state.scores).some(([id, score]) => id !== playerId && score === mine),
  };
}

export const game: GameDefinition<State, Input, BonkTvView, BonkControllerView> = {
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
