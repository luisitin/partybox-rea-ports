// Slither.io's pure match definition and public stage/controller projections.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  pausedFor,
  seedRng,
  setConnected,
} from '@partybox/game-sdk';
import type { ControllerView, GameDefinition, InitContext, TvView } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, inputSchema } from './types';
import type { Input, State, World } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}
export interface SnakeTvView extends TvView, MatchView {
  world: World;
}
export interface SnakeControllerView extends ControllerView, MatchView {
  world?: World;
  slot: number;
  mass: number;
  alive: boolean;
  angle: number;
  boost: boolean;
  respawnIn: number;
  rank: number | null;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  return enterPlay(
    {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      rng: seedRng(ctx.seed),
      players,
      world: { snakes: [], food: [], elapsed: 0 },
      began: ctx.now,
      endsAt: ctx.now,
      round: 1,
      settings: { rounds: numberSetting(manifest, ctx.settings, 'rounds') },
      scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
      lastPoints: {},
      phoneOnly: ctx.presence?.phoneOnly === true,
    },
    ctx.now,
  );
}

function advance(state: State, now: number): State {
  if (state.phase.id === 'play') return advancePlay(state, now, enterScore);
  if (state.phase.id === 'score')
    return state.round >= state.settings.rounds
      ? enterDone(state, now)
      : enterPlay(state, now, state.round + 1);
  return state;
}

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  skip: (s, now) => (s.phase.id === 'play' ? enterScore(settle(s, now), now) : advance(s, now)),
  end: (s, now) =>
    enterDone(
      s.phase.id === 'play' ? enterScore(settle(s, s.phase.paused?.at ?? now), now) : s,
      now,
    ),
  onPlayer: (s, e) => {
    const next = setConnected(s, e);
    return e.connected || !hasPlayer(s, e.playerId)
      ? next
      : {
          ...next,
          world: {
            ...next.world,
            snakes: next.world.snakes.map((x) =>
              x.id === e.playerId ? { ...x, boost: false } : x,
            ),
          },
        };
  },
  prepare: (s, e) => {
    if (e.type !== 'vip') return s;
    if (e.action === 'pause' && s.phase.id === 'play' && !s.phase.paused) {
      const next = settle(s, Math.min(e.now, s.endsAt));
      return {
        ...next,
        world: { ...next.world, snakes: next.world.snakes.map((x) => ({ ...x, boost: false })) },
      };
    }
    if (e.action !== 'resume' || s.phase.id !== 'play') return s;
    const ms = pausedFor(s, e.now);
    return ms <= 0 ? s : { ...s, began: s.began + ms, endsAt: s.endsAt + ms };
  },
});

const matchView = (s: State): MatchView => ({
  round: s.round,
  rounds: s.settings.rounds,
  began: s.began,
  endsAt: s.endsAt,
  scores: s.scores,
  lastPoints: s.lastPoints,
});
const statusOf =
  (s: State) =>
  (id: string): 'active' | 'waiting' =>
    s.phase.id === 'play' && s.world.snakes.some((x) => x.id === id && x.respawnAt === null)
      ? 'active'
      : 'waiting';
const deadline = (s: State): number | null => (s.phase.id === 'play' ? s.endsAt : s.phase.deadline);

function tvView(s: State): SnakeTvView {
  return {
    ...envelope(s, manifest.id, { statusOf: statusOf(s) }),
    ...matchView(s),
    world: s.world,
    deadline: deadline(s),
    timerMode: 'quiet',
  };
}

function controllerView(s: State, id: string): SnakeControllerView {
  const slot = s.world.snakes.findIndex((x) => x.id === id),
    snake = s.world.snakes[slot];
  const stage = s.phoneOnly || !hasPlayer(s, id) || s.players[id]?.canSeeTv === false;
  return {
    ...controllerEnvelope(s, manifest.id, id, { statusOf: statusOf(s) }),
    ...matchView(s),
    deadline: deadline(s),
    ...(stage ? { world: s.world } : {}),
    slot,
    mass: snake?.mass ?? 0,
    alive: snake?.respawnAt === null,
    angle: snake?.target ?? 0,
    boost: snake?.boost ?? false,
    respawnIn:
      snake?.respawnAt === null || !snake ? 0 : Math.max(0, snake.respawnAt - s.world.elapsed),
    rank:
      s.phase.id === 'done' && hasPlayer(s, id)
        ? 1 + Object.values(s.scores).filter((n) => n > (s.scores[id] ?? 0)).length
        : null,
  };
}

export const game: GameDefinition<State, Input, SnakeTvView, SnakeControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: {
    sampleInput: (s, id, _rng, skill) =>
      s.phase.id === 'play' && hasPlayer(s, id) && s.players[id]!.connected
        ? botInput(s.world, id, skill)
        : null,
  },
};
