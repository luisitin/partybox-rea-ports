// Blob Arena's match lifecycle and deliberately small, public views.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  pausedFor,
  seedRng,
  setConnected,
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
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, SPLIT_COOLDOWN_MS, SPLIT_MIN, MAX_CELLS, inputSchema } from './types';
import type { Cell, Input, Pellet, State } from './types';
import { totalMass } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
export interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  checked: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  masses: Record<string, number>;
  slots: Record<string, number>;
}
export interface ArenaView {
  cells: Cell[];
  pellets: Pellet[];
}
export interface BlobArenaTvView extends TvView, MatchView, ArenaView {}
export interface BlobArenaControllerView extends ControllerView, MatchView {
  arena?: ArenaView;
  slot: number;
  mass: number;
  canSplit: boolean;
  splitReason: string;
  respawnIn: number;
  rank: number | null;
}
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, p]));
  const base: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    rng: seedRng(ctx.seed),
    players,
    world: { time: 0, serial: 1, cells: [], pellets: [], controls: {}, respawns: {} },
    began: ctx.now,
    endsAt: ctx.now,
    round: 1,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    lastPoints: {},
    left: [],
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  return enterPlay(base, ctx.now);
}
const advance = (state: State, now: number): State => {
  if (state.phase.id === 'play') return advancePlay(state, now, enterScore);
  if (state.phase.id === 'score')
    return state.round >= 3 ? enterDone(state, now) : enterPlay(state, now, state.round + 1);
  return state;
};
const reduce = composeReduce<State, Input>({
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
      state.phase.id === 'play' &&
      !state.phase.paused
    )
      return settle(state, event.now);
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'play')
      return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms, endsAt: state.endsAt + ms } : state;
  },
  onPlayer: (state, event) => {
    if (!hasPlayer(state, event.playerId)) return state;
    const settled =
      state.phase.id === 'play' && !state.phase.paused ? settle(state, event.now) : state;
    const s = setConnected(settled, event);
    const left =
      event.gone && !s.left.includes(event.playerId) ? [...s.left, event.playerId] : s.left;
    const control = s.world.controls[event.playerId];
    return !event.connected && control
      ? {
          ...s,
          left,
          world: {
            ...s.world,
            controls: { ...s.world.controls, [event.playerId]: { ...control, x: 0, y: 0 } },
          },
        }
      : { ...s, left };
  },
});
const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' &&
    state.world.cells.some((c) => c.owner === id) &&
    !state.left.includes(id)
      ? 'active'
      : 'waiting';
const matchView = (state: State): MatchView => ({
  round: state.round,
  rounds: 3,
  began: state.began,
  endsAt: state.endsAt,
  checked: state.world.time,
  scores: state.scores,
  lastPoints: state.lastPoints,
  slots: Object.fromEntries(Object.keys(state.players).map((id, i) => [id, i])),
  masses: Object.fromEntries(
    Object.keys(state.players).map((id) => [id, Math.floor(totalMass(state.world, id))]),
  ),
});
const deadline = (state: State): number | null =>
  state.phase.id === 'play' ? state.endsAt : state.phase.deadline;
function tvView(state: State): BlobArenaTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: deadline(state),
    timerMode: 'quiet',
    cells: state.world.cells,
    pellets: state.world.pellets,
  };
}
function controllerView(state: State, playerId: string): BlobArenaControllerView {
  const mine = state.world.cells.filter((c) => c.owner === playerId);
  const member = hasPlayer(state, playerId) && !state.left.includes(playerId);
  const control = Object.hasOwn(state.world.controls, playerId)
    ? state.world.controls[playerId]
    : undefined;
  let splitReason = !member
    ? 'Watching'
    : mine.length === 0
      ? 'Returning soon'
      : mine.length >= MAX_CELLS
        ? 'Four blobs maximum'
        : !mine.some((c) => c.mass >= SPLIT_MIN)
          ? 'Grow one blob to 48 mass'
          : mine.every((c) => c.shieldUntil > state.world.time)
            ? 'Spawn shield'
            : control && state.world.time - control.splitAt < SPLIT_COOLDOWN_MS
              ? 'Split cooling down'
              : !control || Math.hypot(control.x, control.y) < 0.1
                ? 'Steer to aim'
                : 'Ready to lunge';
  if (state.phase.id !== 'play' || state.phase.paused) splitReason = 'Round held';
  const stage = state.phoneOnly || (member && state.players[playerId]?.canSeeTv === false);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: deadline(state),
    ...(stage ? { arena: { cells: state.world.cells, pellets: state.world.pellets } } : {}),
    slot: Object.keys(state.players).indexOf(playerId),
    mass: Math.floor(totalMass(state.world, playerId)),
    canSplit: splitReason === 'Ready to lunge',
    splitReason,
    respawnIn: Object.hasOwn(state.world.respawns, playerId)
      ? Math.max(0, state.world.respawns[playerId]! - state.world.time)
      : 0,
    rank:
      state.phase.id === 'done' && member
        ? 1 + Object.values(state.scores).filter((n) => n > (state.scores[playerId] ?? 0)).length
        : null,
  };
}
export const game: GameDefinition<State, Input, BlobArenaTvView, BlobArenaControllerView> = {
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
