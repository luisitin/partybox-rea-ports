// Curve Fever — worms that never stop, trails that never fade, and a TV full of them (a PartyBox take on the browser classic).
// `game` is what the registry imports.
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
import { advancePlay, enterPlay, reducePlay, skipPlay } from './phases/play';
import { enterReady, reduceReady } from './phases/ready';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES } from './types';
import type { State } from './types';
import { aliveCount, inputSchema } from './world';
import type { Input, Worm } from './world';

// Parsed once: a typo in manifest.json fails at import time instead of deep inside the engine.
const manifest = gameManifestSchema.parse(manifestJson);

/** What the screens share: the clocks, the board's judged time and the standings. */
interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  /** Everything up to here (ms after `began`) has been judged: a trail is drawn up to a worm's death or this time. */
  checked: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

export interface CurveFeverTvView extends TvView, MatchView {
  /** The whole arena: nothing is hidden. The player at `worms[i]` is `worms[i].id`. */
  worms: Worm[];
  alive: number;
}

export interface CurveFeverControllerView extends ControllerView, MatchView {
  /**
   * The whole arena, as in the TV view (public: nothing is hidden), only for a phone that is the stage: a room with no TV, or a
   * player who can't see it. A phone with a TV in front of it is not sent it, which keeps its updates small.
   */
  worms?: Worm[];
  /** This phone's worm: its colour slot, whether it lives, and the way it is steering now (-1, 0, 1). */
  slot: number;
  alive: boolean;
  turn: number;
  /** Worms still alive, and all of them. */
  aliveCount: number;
  total: number;
  /** 1 = the top score; only once the match is over. */
  rank: number | null;
  /** Another player finished on the same score: shared first place. */
  tied: boolean;
}

function init(ctx: InitContext): State {
  const players: State['players'] = {};
  for (const p of ctx.players) players[p.id] = p;
  const rounds = numberSetting(manifest, ctx.settings, 'rounds');
  const scores: State['scores'] = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  const base: State = {
    phase: { id: 'ready', startedAt: ctx.now, deadline: null },
    rng: seedRng(ctx.seed),
    players,
    began: ctx.now,
    endsAt: ctx.now,
    world: { worms: [], stepped: -1 },
    checked: 0,
    round: 1,
    scores,
    lastPoints: {},
    settings: { rounds },
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  return enterReady(base, ctx.now, 1);
}

/** A pause held the round's clock: its start and end move on by as long as it lasted. */
function shifted(state: State, ms: number): State {
  return ms <= 0 || state.phase.id !== 'play'
    ? state
    : { ...state, began: state.began + ms, endsAt: state.endsAt + ms };
}

/** The score screen's exit: the next round, or the end of the match. */
const afterScore = (state: State, now: number): State =>
  state.round >= state.settings.rounds
    ? enterDone(state, now)
    : enterReady(state, now, state.round + 1);

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

const reduce = composeReduce<State, Input>({
  phases: { ready: reduceReady, play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? skipPlay(state, now, enterScore) : advance(state, now),
  end: enterDone,
  prepare: (state, event) =>
    event.type === 'vip' && event.action === 'resume'
      ? shifted(state, pausedFor(state, event.now))
      : state,
});

const statusOf =
  (state: State) =>
  (playerId: string): PlayerStatus => {
    if (state.phase.id !== 'play') return 'waiting';
    return state.world.worms.some((w) => w.id === playerId && w.died === null)
      ? 'active'
      : 'waiting';
  };

const matchView = (state: State): MatchView => ({
  round: state.round,
  rounds: state.settings.rounds,
  began: state.began,
  endsAt: state.endsAt,
  checked: state.checked,
  scores: state.scores,
  lastPoints: state.lastPoints,
});

/** The screens count down to the round's end (`endsAt`), not the tick the engine re-arms (ADR-033). */
const roundEnds = (state: State): number | null =>
  state.phase.id === 'play' && state.phase.deadline !== null ? state.endsAt : state.phase.deadline;

function tvView(state: State): CurveFeverTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    deadline: roundEnds(state),
    // The TV owns its countdown and clock (Tv.tsx); the arena gets the shell timer's space too.
    timerMode: 'hidden',
    ...matchView(state),
    worms: state.world.worms,
    alive: aliveCount(state.world),
  };
}

/** Whether this phone draws the arena itself: the room has no TV, or this player can't see it (ADR-047). */
const phoneIsStage = (state: State, playerId: string): boolean =>
  state.phoneOnly === true || state.players[playerId]?.canSeeTv === false;

function controllerView(state: State, playerId: string): CurveFeverControllerView {
  const slot = state.world.worms.findIndex((w) => w.id === playerId);
  const worm = state.world.worms[slot];
  const mine = state.scores[playerId] ?? 0;
  const over = state.phase.id === 'done' && hasPlayer(state, playerId);
  const tied =
    over && Object.entries(state.scores).some(([id, s]) => id !== playerId && s === mine);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    deadline: roundEnds(state),
    ...matchView(state),
    ...(phoneIsStage(state, playerId) ? { worms: state.world.worms } : {}),
    slot,
    alive: worm !== undefined && worm.died === null,
    turn: worm ? (worm.segs[worm.segs.length - 1]?.[4] ?? 0) : 0,
    aliveCount: aliveCount(state.world),
    total: state.world.worms.length,
    rank: over ? 1 + Object.values(state.scores).filter((s) => s > mine).length : null,
    tied,
  };
}

export const game: GameDefinition<State, Input, CurveFeverTvView, CurveFeverControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: {
    // A bot has no clock: it reads the board at the last judged moment.
    sampleInput(state, playerId) {
      if (state.phase.id !== 'play' || !hasPlayer(state, playerId)) return null;
      return botInput(state.world, playerId, state.checked);
    },
  },
};
