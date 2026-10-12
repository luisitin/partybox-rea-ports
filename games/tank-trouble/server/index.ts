import {
  boolSetting,
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
import { advancePlay, enterPlay, isOver, reducePlay, settle, skipPlay } from './phases/play';
import { enterReady, freshRound, reduceReady } from './phases/ready';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, ROUNDS } from './types';
import type { RoundReason, State } from './types';
import { aliveCount, inputSchema, stopTank } from './world';
import type { Arena, Input, Weapon } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  checked: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  aliveCount: number;
  total: number;
  winnerIds: string[];
  reason: RoundReason;
  arena: Arena;
  slots: Record<string, number>;
}
export interface TankTroubleTvView extends TvView, MatchView {}
export interface TankTroubleControllerView extends ControllerView, MatchView {
  participating: boolean;
  slot: number;
  alive: boolean;
  drive: number;
  turn: number;
  fire: boolean;
  weapon: Weapon;
  ammo: number;
  rank: number | null;
  tied: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const base: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    rng: seedRng(ctx.seed),
    players,
    began: ctx.now,
    endsAt: ctx.now,
    checked: 0,
    world: {
      maze: { cols: 10, rows: 6, cell: 16, walls: [] },
      tanks: [],
      bullets: [],
      pickups: [],
      stepped: 0,
      nextBullet: 1,
      safeUntil: 700,
    },
    round: 1,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    lastPoints: {},
    winnerIds: [],
    reason: null,
    left: [],
    settings: {
      powerups: boolSetting(manifest, ctx.settings, 'powerups'),
    },
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  // The shell already showed the game's start rules/countdown. A new match goes straight to play.
  return enterPlay(freshRound(base, ctx.now, 1), ctx.now);
}
const afterScore = (state: State, now: number): State =>
  state.round >= ROUNDS ? enterDone(state, now) : enterReady(state, now, state.round + 1);
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
const composed = composeReduce<State, Input>({
  phases: { ready: reduceReady, play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? skipPlay(state, now, enterScore) : advance(state, now),
  end: enterDone,
  onPlayer(state, event) {
    if (!hasPlayer(state, event.playerId)) return state;
    const settled =
      state.phase.id === 'play' && !state.phase.paused ? settle(state, event.now) : state;
    const judged =
      settled.phase.id === 'play' && !settled.phase.paused && isOver(settled)
        ? enterScore(settled, event.now)
        : settled;
    const after = onPlayerEvent(judged, event);
    const world =
      !event.connected || event.gone
        ? stopTank(after.world, event.playerId, !!event.gone)
        : after.world;
    const next = { ...after, world };
    return next.phase.id === 'play' && !next.phase.paused && isOver(next)
      ? enterScore(next, event.now)
      : next;
  },
  prepare(state, event) {
    if (event.type !== 'vip') return state;
    if (event.action === 'pause' && state.phase.id === 'play' && !state.phase.paused) {
      const stopped = settle(state, event.now);
      const neutralized = {
        ...stopped,
        world: {
          ...stopped.world,
          tanks: stopped.world.tanks.map((tank) => ({
            ...tank,
            drive: 0,
            turn: 0,
            fire: false,
            inputUntil: 0,
          })),
        },
      };
      return isOver(neutralized) ? enterScore(neutralized, event.now) : neutralized;
    }
    if (event.action !== 'resume' || state.phase.id !== 'play') return state;
    const ms = pausedFor(state, event.now);
    return ms <= 0 ? state : { ...state, began: state.began + ms, endsAt: state.endsAt + ms };
  },
  afterVip(_before, after, event) {
    return event.type === 'vip' &&
      event.action === 'resume' &&
      after.phase.id === 'play' &&
      isOver(after)
      ? enterScore(after, event.now)
      : after;
  },
});
const reduce = (state: State, event: Parameters<typeof composed>[1]): State =>
  state.phase.id === 'done' ? state : composed(state, event);

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.world.tanks.some((tank) => tank.id === id && tank.alive)
      ? 'active'
      : 'waiting';
const deadline = (state: State): number | null =>
  state.phase.id === 'play' ? state.endsAt : state.phase.deadline;
function matchView(state: State): MatchView {
  return {
    round: state.round,
    rounds: ROUNDS,
    began: state.began,
    endsAt: state.endsAt,
    checked: state.checked,
    scores: state.scores,
    lastPoints: state.lastPoints,
    aliveCount: aliveCount(state.world),
    total: state.world.tanks.length,
    winnerIds: state.winnerIds,
    reason: state.reason,
    slots: Object.fromEntries(Object.keys(state.players).map((id, slot) => [id, slot])),
    arena: {
      maze: state.world.maze,
      tanks: state.world.tanks,
      bullets: state.world.bullets,
      pickups: state.world.pickups,
      stepped: state.world.stepped,
    },
  };
}
function tvView(state: State): TankTroubleTvView {
  return {
    ...envelope(state, manifest.id, {
      statusOf: statusOf(state),
      scores: state.scores,
      deadline: deadline(state),
    }),
    timerMode: 'hidden',
    ...matchView(state),
  };
}
function controllerView(state: State, id: string): TankTroubleControllerView {
  const tank = state.world.tanks.find((t) => t.id === id);
  const over = state.phase.id === 'done' && hasPlayer(state, id);
  const points = state.scores[id] ?? 0;
  return {
    ...controllerEnvelope(state, manifest.id, id, {
      statusOf: statusOf(state),
      scores: state.scores,
      deadline: deadline(state),
    }),
    ...matchView(state),
    participating: hasPlayer(state, id) && !state.left.includes(id),
    slot: tank?.slot ?? -1,
    alive: tank?.alive ?? false,
    drive: tank?.drive ?? 0,
    turn: tank?.turn ?? 0,
    fire: tank?.fire ?? false,
    weapon: tank?.weapon ?? 'shell',
    ammo: tank?.ammo ?? 0,
    rank: over ? 1 + Object.values(state.scores).filter((score) => score > points).length : null,
    tied:
      over &&
      Object.entries(state.scores).some(([other, score]) => other !== id && score === points),
  };
}
export const game: GameDefinition<State, Input, TankTroubleTvView, TankTroubleControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: {
    sampleInput(state, id, rng, skill) {
      return state.phase.id === 'play' &&
        !state.phase.paused &&
        hasPlayer(state, id) &&
        state.players[id]?.connected &&
        !state.left.includes(id)
        ? botInput(state.world, id, state.checked, rng, skill)
        : null;
    },
  },
};
