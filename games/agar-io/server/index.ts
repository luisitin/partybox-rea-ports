// Agar.io's match lifecycle and deliberately small, public views.
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
import { PHASES, ROUND_MS, SPLIT_COOLDOWN_MS, SPLIT_MIN, MAX_CELLS, inputSchema } from './types';
import type { Cell, Input, Pellet, State } from './types';
import { release, retire, totalMass } from './world';

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
  departedIds: string[];
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
  member: boolean;
  departed: boolean;
  connected: boolean;
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
/** Releases use frozen active time while paused, never wall time accumulated during the hold. */
const releaseTime = (state: State, now: number): number =>
  state.phase.id === 'play'
    ? Math.max(0, Math.min(ROUND_MS, (state.phase.paused?.at ?? now) - state.began))
    : state.world.time;

const composed = composeReduce<State, Input>({
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
    ) {
      const settled = settle(state, event.now);
      // The phone releases its pad when pause disables it; paused inputs cannot deliver that stop.
      // Neutralize held steering now so an idle phone never resumes an old direction.
      return {
        ...settled,
        world: release(settled.world, undefined, releaseTime(settled, event.now)),
      };
    }
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'play')
      return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms, endsAt: state.endsAt + ms } : state;
  },
  onPlayer: (state, event) => {
    if (!hasPlayer(state, event.playerId)) return state;
    const settled =
      state.phase.id === 'play' && !state.phase.paused ? settle(state, event.now) : state;
    let s = setConnected(settled, event);
    const left =
      event.gone && !s.left.includes(event.playerId) ? [...s.left, event.playerId] : s.left;
    const departed = left.includes(event.playerId);
    if (departed && s.players[event.playerId]?.connected)
      s = {
        ...s,
        players: {
          ...s.players,
          [event.playerId]: { ...s.players[event.playerId]!, connected: false },
        },
      };
    const at = releaseTime(s, event.now);
    // A refresh can reconnect inside the host grace period without ever emitting a drop.
    const world = departed
      ? retire(s.world, event.playerId, at)
      : release(s.world, event.playerId, at);
    return world === s.world && left === s.left ? s : { ...s, left, world };
  },
});
const reduce: typeof composed = (state, event) =>
  event.type === 'input' && !inputSchema.safeParse(event.input).success
    ? state
    : composed(state, event);
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
  departedIds: state.left,
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
  const known = hasPlayer(state, playerId);
  const departed = state.left.includes(playerId);
  const member = known && !departed;
  const connected = known && !departed && !!state.players[playerId]?.connected;
  const control = Object.hasOwn(state.world.controls, playerId)
    ? state.world.controls[playerId]
    : undefined;
  let splitReason = !member
    ? 'Watching'
    : !connected
      ? 'Disconnected'
      : mine.length === 0
        ? 'Returning soon'
        : mine.length >= MAX_CELLS
          ? 'Four blobs maximum'
          : !mine.some((c) => c.mass >= SPLIT_MIN)
            ? 'Grow one blob to 48 mass'
            : mine.filter((c) => c.mass >= SPLIT_MIN).every((c) => c.shieldUntil > state.world.time)
              ? 'Spawn shield'
              : control && state.world.time - control.splitAt < SPLIT_COOLDOWN_MS
                ? 'Split cooling down'
                : !control || Math.hypot(control.x, control.y) < 0.1
                  ? 'Steer to aim'
                  : 'Ready to lunge';
  if (member && (state.phase.id !== 'play' || state.phase.paused)) splitReason = 'Round held';
  const stage =
    !member || state.phoneOnly || (known && state.players[playerId]?.canSeeTv === false);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    ...matchView(state),
    deadline: deadline(state),
    ...(stage ? { arena: { cells: state.world.cells, pellets: state.world.pellets } } : {}),
    slot: Object.keys(state.players).indexOf(playerId),
    mass: Math.floor(totalMass(state.world, playerId)),
    member,
    departed,
    connected,
    canSplit: splitReason === 'Ready to lunge',
    splitReason,
    respawnIn:
      member && Object.hasOwn(state.world.respawns, playerId)
        ? Math.max(0, state.world.respawns[playerId]! - state.world.time)
        : 0,
    rank:
      state.phase.id === 'done' && known
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
