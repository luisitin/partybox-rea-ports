// Octo Rally: one timed match, eight defensive sides, and an entirely public arena.
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
  GameEvent,
  InitContext,
  PlayerStatus,
  TvView,
} from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, over, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results, scoresOf } from './scoring';
import { PHASES } from './types';
import type { State } from './types';
import { aliveCount, inputSchema, makeWorld, ROUND_MS, TICK_MS } from './world';
import type { Input, PublicWorld } from './world';

export type { State } from './types';
export type { Input } from './world';

const manifest = gameManifestSchema.parse(manifestJson);

export interface MatchView {
  began: number;
  endsAt: number;
  checked: number;
  /** Public arena, persistent across all phases and present on every phone. */
  world: PublicWorld;
  scores: Record<string, number>;
  aliveCount: number;
  total: number;
  winnerIds: string[];
}
export interface PongPartyTvView extends TvView, MatchView {}
export interface PongPartyControllerView extends ControllerView, MatchView {
  /** This player started outside sight of the TV; their phone supplies the shared stage. */
  phoneStage: boolean;
  slot: number;
  position: number;
  lives: number;
  saves: number;
  alive: boolean;
  rank: number | null;
  tied: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, p]));
  const [world, rng] = makeWorld(seedRng(ctx.seed), Object.keys(players));
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    players,
    rng,
    began: ctx.now,
    endsAt: ctx.now + ROUND_MS,
    checked: 0,
    world,
    scores: Object.fromEntries(Object.keys(players).map((id) => [id, 0])),
  };
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

/** Settle a running arena before a VIP freezes or ends it; resumed clocks hold every serve too. */
function prepare(state: State, event: GameEvent<Input>): State {
  if (state.phase.id !== 'play' || event.type !== 'vip') return state;
  if (event.action === 'resume' && state.phase.paused) {
    const duration = pausedFor(state, event.now);
    return duration <= 0
      ? state
      : { ...state, began: state.began + duration, endsAt: state.endsAt + duration };
  }
  if (state.phase.paused || event.action === 'resume') return state;
  const judged = settle(state, event.now);
  return event.action === 'pause' && over(judged) ? enterScore(judged, event.now) : judged;
}

const composed = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  end: enterDone,
  prepare,
  skip: (state, now) =>
    state.phase.id === 'play' ? enterScore(settle(state, now), now) : advance(state, now),
});

const reduce = (state: State, event: GameEvent<Input>): State =>
  Number.isFinite(event.now) ? composed(state, event) : state;

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.world.paddles.some((p) => p.id === id && p.lives > 0)
      ? 'active'
      : 'waiting';

function matchView(state: State): MatchView {
  const scores = state.phase.id === 'play' ? scoresOf(state) : state.scores;
  const maximum = Math.max(0, ...Object.values(scores));
  return {
    began: state.began,
    endsAt: state.endsAt,
    checked: state.checked,
    world: { paddles: state.world.paddles, balls: state.world.balls, stepped: state.world.stepped },
    scores,
    aliveCount: aliveCount(state.world),
    total: state.world.paddles.length,
    winnerIds:
      state.phase.id === 'play' ? [] : Object.keys(scores).filter((id) => scores[id] === maximum),
  };
}

function tvView(state: State): PongPartyTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    timerMode: 'hidden',
  };
}

function controllerView(state: State, id: string): PongPartyControllerView {
  const seat = hasPlayer(state, id) ? state.world.paddles.find((p) => p.id === id) : undefined;
  const common = matchView(state);
  const mine = hasPlayer(state, id) ? (common.scores[id] ?? 0) : 0;
  const ranked = state.phase.id !== 'play' && seat !== undefined;
  return {
    ...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }),
    ...common,
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    slot: seat?.slot ?? -1,
    phoneStage: hasPlayer(state, id) && state.players[id]?.canSeeTv === false,
    position: seat?.position ?? 0.5,
    lives: seat?.lives ?? 0,
    saves: seat?.saves ?? 0,
    alive: seat !== undefined && seat.lives > 0,
    rank: ranked ? 1 + Object.values(common.scores).filter((score) => score > mine).length : null,
    tied:
      ranked &&
      Object.entries(common.scores).some(([other, score]) => other !== id && score === mine),
  };
}

export const game: GameDefinition<State, Input, PongPartyTvView, PongPartyControllerView> = {
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
