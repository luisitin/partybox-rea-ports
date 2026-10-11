// PartyBox entry: pure event composition, bounded public views and seeded climbing.
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
import { makeWorld } from './content';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterReady, reduceReady } from './phases/ready';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { H, PHASES, inputSchema } from './types';
import type { Climber, Input, Platform, State } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  elapsed: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  climbers: Climber[];
  platforms: Platform[];
}
export interface ClimbTvView extends TvView, MatchView {}
export interface ClimbControllerView extends ControllerView, MatchView {
  mine: Climber | null;
  rank: number | null;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const [world, rng] = makeWorld(seedRng(ctx.seed), Object.keys(players));
  return enterPlay(
    {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      players,
      rng,
      world,
      began: ctx.now,
      endsAt: ctx.now,
      elapsed: 0,
      round: 1,
      scores: Object.fromEntries(Object.keys(players).map((id) => [id, 0])),
      lastPoints: {},
      settings: {
        rounds: numberSetting(manifest, ctx.settings, 'rounds'),
        seconds: numberSetting(manifest, ctx.settings, 'seconds'),
      },
      phoneOnly: ctx.presence?.phoneOnly ?? false,
    },
    ctx.now,
  );
}

function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'play':
      return advancePlay(state, now, enterScore);
    case 'score':
      return state.round >= state.settings.rounds ? enterDone(state, now) : enterReady(state, now);
    case 'ready':
      return enterPlay(state, now);
    default:
      return state;
  }
}

function prepare(state: State, event: GameEvent<Input>): State {
  if (state.phase.id !== 'play' || event.type !== 'vip') return state;
  if (state.phase.paused && (event.action === 'resume' || event.action === 'skip')) {
    const ms = pausedFor(state, event.now);
    return { ...state, began: state.began + ms, endsAt: state.endsAt + ms };
  }
  return !state.phase.paused && ['pause', 'end', 'skip'].includes(event.action)
    ? settle(state, event.now)
    : state;
}

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore, ready: reduceReady },
  advance,
  skip: (s, now) => (s.phase.id === 'play' ? enterScore(settle(s, now), now) : advance(s, now)),
  end: enterDone,
  prepare,
  onPlayer: (state, event) => {
    const s = setConnected(state, event);
    if (!hasPlayer(state, event.playerId) || event.connected) return s;
    // A lost hold ends immediately; the jumper still bounces and the clock carries on.
    return {
      ...s,
      world: {
        ...s.world,
        climbers: s.world.climbers.map((c) =>
          c.id === event.playerId
            ? { ...c, dir: 0, ...(event.gone ? { died: s.elapsed } : {}) }
            : c,
        ),
      },
    };
  },
});

const statusOf =
  (s: State) =>
  (id: string): PlayerStatus =>
    s.phase.id === 'play' && s.world.climbers.some((c) => c.id === id && c.died === null)
      ? 'active'
      : 'waiting';

function matchView(state: State): MatchView {
  // The route beyond a visible camera window is unrevealed content, not a bot shortcut.
  const platforms = state.world.platforms.filter((p) =>
    state.world.climbers.some((c) => p.y >= c.camera - 24 && p.y <= c.camera + H),
  );
  return {
    round: state.round,
    rounds: state.settings.rounds,
    began: state.began,
    endsAt: state.endsAt,
    elapsed: state.elapsed,
    scores: state.scores,
    lastPoints: state.lastPoints,
    climbers: state.world.climbers,
    platforms,
  };
}
const deadline = (s: State): number | null => (s.phase.id === 'play' ? s.endsAt : s.phase.deadline);

function tvView(state: State): ClimbTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    deadline: deadline(state),
    timerMode: 'hidden',
    ...matchView(state),
  };
}
function controllerView(state: State, id: string): ClimbControllerView {
  const mine = state.world.climbers.find((c) => c.id === id) ?? null;
  const score = state.scores[id] ?? 0;
  return {
    ...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }),
    deadline: deadline(state),
    ...matchView(state),
    mine,
    rank:
      state.phase.id === 'done' && hasPlayer(state, id)
        ? 1 + Object.values(state.scores).filter((n) => n > score).length
        : null,
  };
}

export const game: GameDefinition<State, Input, ClimbTvView, ClimbControllerView> = {
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
