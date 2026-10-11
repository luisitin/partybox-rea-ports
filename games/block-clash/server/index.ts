// Block Clash binds its pure board engine to SDK pause, player, timer, and view envelopes.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  nextInt,
  pausedFor,
  seedRng,
  setConnected,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerEvent, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { emptyGrid, spawn, topped } from './board';
import { finished, inputSchema, normalizeTargets, settle } from './engine';
import { dropY } from './pieces';
import { enterDone } from './phases/done';
import { advancePlay } from './phases/play';
import { reducePlay } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { standings, results } from './scoring';
import { nextPieces } from './sequence';
import { PHASES, ROUND_MS, TICK_MS } from './types';
import type {
  BlockClashControllerView,
  BlockClashTvView,
  Board,
  BoardView,
  Input,
  MatchView,
  State,
} from './types';
export type { BlockClashControllerView, BlockClashTvView } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const [pieceSeed, rng] = nextInt(seedRng(ctx.seed), 0, 0xffffffff);
  const base: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    players: Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }])),
    rng,
    pieceSeed,
    began: ctx.now,
    endsAt: ctx.now + ROUND_MS,
    checked: ctx.now,
    boards: [],
    botSkill: ctx.botSkill ?? 'normal',
    phoneOnly: ctx.presence?.phoneOnly ?? false,
  };
  const boards = ctx.players.map((player, i): Board => ({
    id: player.id,
    grid: emptyGrid(),
    active: null,
    alive: true,
    score: 0,
    lines: 0,
    attack: 0,
    pending: 0,
    target: ctx.players[(i + 1) % ctx.players.length]?.id ?? null,
    sequence: 0,
    hold: null,
    canHold: true,
    nextFall: ctx.now,
    lockAt: null,
    lockResets: 0,
    diedAt: null,
    lastRotate: false,
    lastInputAt: ctx.now - 1,
    combo: -1,
    b2b: false,
    plan: null,
  }));
  return { ...base, boards: boards.map((board) => spawn(base, board, ctx.now)) };
}
function shifted(state: State, ms: number): State {
  if (ms <= 0 || state.phase.id !== 'play') return state;
  return {
    ...state,
    began: state.began + ms,
    endsAt: state.endsAt + ms,
    checked: state.checked + ms,
    boards: state.boards.map((board) => ({
      ...board,
      nextFall: board.nextFall + ms,
      lockAt: board.lockAt === null ? null : board.lockAt + ms,
      diedAt: board.diedAt === null ? null : board.diedAt + ms,
      lastInputAt: board.lastInputAt + ms,
    })),
  };
}
function advance(state: State, now: number): State {
  if (state.phase.id === 'play') return advancePlay(state, now, enterScore);
  return state.phase.id === 'score' ? enterDone(state, now) : state;
}
function onPlayer(state: State, event: PlayerEvent): State {
  if (!hasPlayer(state, event.playerId)) return state;
  let next = setConnected(state, event);
  if (!event.gone || next.phase.id !== 'play') return next;
  if (!next.phase.paused) next = settle(next, event.now);
  const at = next.checked;
  next = {
    ...next,
    boards: next.boards.map((board) =>
      board.id === event.playerId && board.alive ? topped(board, at) : board,
    ),
  };
  next = normalizeTargets(next);
  return !next.phase.paused && finished(next) ? enterScore(next, at) : next;
}
const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  skip: (state, now) =>
    state.phase.id === 'play' ? enterScore(settle(state, now), now) : advance(state, now),
  end: (state, now) =>
    enterDone(state.phase.id === 'play' && !state.phase.paused ? settle(state, now) : state, now),
  onPlayer,
  prepare: (state, event) => {
    if (event.type !== 'vip') return state;
    if (event.action === 'resume') return shifted(state, pausedFor(state, event.now));
    if (event.action === 'pause' && state.phase.id === 'play' && !state.phase.paused) {
      const settled = settle(state, event.now);
      return finished(settled) ? enterScore(settled, settled.checked) : settled;
    }
    return state;
  },
  afterVip: (_before, after, event) =>
    event.type === 'vip' &&
    event.action === 'resume' &&
    after.phase.id === 'play' &&
    finished(after)
      ? enterScore(after, event.now)
      : after,
});

function boardView(state: State, board: Board): BoardView {
  return {
    id: board.id,
    name: state.players[board.id]?.name ?? '',
    grid: board.grid,
    active: board.active,
    ghostY: board.active ? dropY(board.grid, board.active) : 0,
    alive: board.alive,
    score: board.score,
    lines: board.lines,
    attack: board.attack,
    pending: board.pending,
    target: board.target,
  };
}
function matchView(state: State): MatchView {
  return {
    screen: state.phase.id === 'play' ? 'play' : state.phase.id === 'score' ? 'score' : 'done',
    boards: state.boards.map((board) => boardView(state, board)),
    standings: standings(state),
    began: state.began,
    endsAt: state.endsAt,
    checked: state.checked,
    remainingMs: Math.max(0, state.endsAt - state.checked),
  };
}
function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) =>
    state.phase.id === 'play' && state.boards.some((board) => board.id === id && board.alive)
      ? 'active'
      : 'waiting';
}
function options(state: State) {
  return {
    statusOf: statusOf(state),
    deadline: state.phase.id === 'play' ? state.endsAt : state.phase.deadline,
    scores: Object.fromEntries(state.boards.map((board) => [board.id, board.score])),
    skipLabel: state.phase.id === 'play' ? 'Finish round' : 'Show results',
  };
}
function tvView(state: State): BlockClashTvView {
  return {
    ...envelope(state, manifest.id, options(state)),
    timerMode: 'hidden',
    ...matchView(state),
  };
}
function controllerView(state: State, id: string): BlockClashControllerView {
  const own = hasPlayer(state, id) ? state.boards.find((board) => board.id === id) : undefined;
  return {
    ...controllerEnvelope(state, manifest.id, id, options(state)),
    ...matchView(state),
    board: own ? boardView(state, own) : null,
    next: own?.alive ? nextPieces(state, own) : [],
    hold: own?.hold ?? null,
    canHold: own?.alive === true && own.canHold,
  };
}
export const game: GameDefinition<State, Input, BlockClashTvView, BlockClashControllerView> = {
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
