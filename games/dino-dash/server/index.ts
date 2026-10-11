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
  InitContext,
  PlayerStatus,
  TvView,
} from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results, scored } from './scoring';
import { PHASES } from './types';
import type { State } from './types';
import { allDead, apply, inputSchema, visibleCourse } from './world';
import type { Input, Obstacle, Runner } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
export interface MatchView {
  round: number;
  rounds: number;
  began: number;
  endsAt: number;
  checked: number;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  runners: Runner[];
  obstacles: Obstacle[];
}
export interface DinoDashTvView extends TvView, MatchView {}
export interface DinoDashControllerView extends ControllerView, MatchView {
  stage: boolean;
  slot: number;
  alive: boolean;
  duck: boolean;
  distance: number;
  rank: number | null;
}
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const base: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    players,
    rng: seedRng(ctx.seed),
    round: 1,
    settings: { rounds: numberSetting(manifest, ctx.settings, 'rounds') },
    began: ctx.now,
    endsAt: ctx.now,
    world: { runners: [], course: [], checked: 0, cursor: 0 },
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    lastPoints: {},
    phoneOnly: ctx.presence?.phoneOnly === true,
    left: [],
  };
  return enterPlay(base, ctx.now, 1);
}
const afterScore = (state: State, now: number): State =>
  state.round >= state.settings.rounds
    ? enterDone(state, now)
    : enterPlay(state, now, state.round + 1);
const advance = (state: State, now: number): State =>
  state.phase.id === 'play'
    ? advancePlay(state, now, enterScore)
    : state.phase.id === 'score'
      ? afterScore(state, now)
      : state;
const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  skip: (s, now) => (s.phase.id === 'play' ? enterScore(settle(s, now), now) : advance(s, now)),
  end: (s, now) =>
    enterDone(s.phase.id === 'play' ? scored(settle(s, s.phase.paused?.at ?? now)) : s, now),
  prepare: (s, e) => {
    if (e.type === 'vip' && e.action === 'pause' && s.phase.id === 'play' && !s.phase.paused)
      return settle(s, e.now);
    if (e.type !== 'vip' || e.action !== 'resume' || s.phase.id !== 'play') return s;
    const ms = pausedFor(s, e.now);
    return ms > 0 ? { ...s, began: s.began + ms, endsAt: s.endsAt + ms } : s;
  },
  // A finger can lift while the VIP holds the clock; honour release without advancing play.
  whilePaused: (s, e) => {
    if (e.input.type !== 'duck' || e.input.down || !hasPlayer(s, e.playerId)) return s;
    const world = apply(s.world, e.playerId, e.input, s.world.checked);
    return world === s.world ? s : { ...s, world };
  },
  onPlayer: (s, e) => {
    if (!hasPlayer(s, e.playerId)) return s;
    const settled = s.phase.id === 'play' && !s.phase.paused ? settle(s, e.now) : s;
    const after = setConnected(settled, e);
    if (e.connected && !e.gone) return after;
    const left =
      e.gone && !after.left.includes(e.playerId) ? [...after.left, e.playerId] : after.left;
    const dropped: State = {
      ...after,
      left,
      world: {
        ...after.world,
        runners: after.world.runners.map((r) =>
          r.id === e.playerId
            ? { ...r, duck: false, died: e.gone ? (r.died ?? after.world.checked) : r.died }
            : r,
        ),
      },
    };
    return dropped.phase.id === 'play' && !dropped.phase.paused && allDead(dropped.world)
      ? enterScore(dropped, e.now)
      : dropped;
  },
});
const statusOf =
  (s: State) =>
  (id: string): PlayerStatus =>
    s.phase.id === 'play' && s.world.runners.some((r) => r.id === id && r.died === null)
      ? 'active'
      : 'waiting';
const matchView = (s: State): MatchView => ({
  round: s.round,
  rounds: s.settings.rounds,
  began: s.began,
  endsAt: s.endsAt,
  checked: s.world.checked,
  scores: s.scores,
  lastPoints: s.lastPoints,
  runners: s.world.runners,
  obstacles: visibleCourse(s.world),
});
const options = (s: State) => ({
  statusOf: statusOf(s),
  scores: s.scores,
  deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
  skipLabel: s.phase.id === 'play' ? 'End this run' : 'Next round',
});
function tvView(state: State): DinoDashTvView {
  return {
    ...envelope(state, manifest.id, options(state)),
    ...matchView(state),
    timerMode: 'hidden',
  };
}
function controllerView(state: State, playerId: string): DinoDashControllerView {
  const slot = state.world.runners.findIndex((r) => r.id === playerId);
  const runner = state.world.runners[slot];
  const score = hasPlayer(state, playerId) ? (state.scores[playerId] ?? 0) : 0;
  return {
    ...controllerEnvelope(state, manifest.id, playerId, options(state)),
    ...matchView(state),
    stage:
      state.phoneOnly ||
      (hasPlayer(state, playerId) && state.players[playerId]?.canSeeTv === false),
    slot,
    alive: runner?.died === null,
    duck: runner?.duck ?? false,
    distance: runner ? Math.floor(runner.distance / 10) : 0,
    rank:
      state.phase.id === 'done' && hasPlayer(state, playerId)
        ? 1 + Object.values(state.scores).filter((n) => n > score).length
        : null,
  };
}
export const game: GameDefinition<State, Input, DinoDashTvView, DinoDashControllerView> = {
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
