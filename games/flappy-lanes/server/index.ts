// The Flappy Lanes plugin: one shared seeded course, pure flight and an automatic three-round match.
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
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES } from './types';
import type { State } from './types';
import { aliveCount, inputSchema, visibleGates } from './world';
import type { Bird, Gate, Input } from './world';

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
}
export interface FlappyTvView extends TvView, MatchView {
  birds: Bird[];
  gates: Gate[];
}
export interface FlappyControllerView extends ControllerView, MatchView {
  birds?: Bird[];
  gates?: Gate[];
  mine: Bird | null;
  slot: number;
  rank: number | null;
  tied: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, p]));
  const state: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    players,
    rng: seedRng(ctx.seed),
    world: { birds: [], course: [], checked: 0 },
    began: ctx.now,
    endsAt: ctx.now,
    round: 1,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    lastPoints: {},
    settings: { rounds: numberSetting(manifest, ctx.settings, 'rounds') },
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  return enterPlay(state, ctx.now, 1);
}
const advance = (s: State, now: number): State => {
  if (s.phase.id === 'play') return advancePlay(s, now, enterScore);
  if (s.phase.id === 'score')
    return s.round >= s.settings.rounds ? enterDone(s, now) : enterPlay(s, now, s.round + 1);
  return s;
};
const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  end: enterDone,
  skip: (s, now) => (s.phase.id === 'play' ? enterScore(settle(s, now), now) : advance(s, now)),
  prepare: (s, event) => {
    if (event.type !== 'vip' || s.phase.id !== 'play') return s;
    if (event.action === 'pause') return s.phase.paused ? s : settle(s, event.now);
    if (event.action !== 'resume') return s;
    const ms = pausedFor(s, event.now);
    return ms <= 0 ? s : { ...s, began: s.began + ms, endsAt: s.endsAt + ms };
  },
});

const statusOf =
  (s: State) =>
  (id: string): PlayerStatus =>
    s.phase.id === 'play' && s.world.birds.some((b) => b.id === id && b.died === null)
      ? 'active'
      : 'waiting';
const common = (s: State): MatchView => ({
  round: s.round,
  rounds: s.settings.rounds,
  began: s.began,
  endsAt: s.endsAt,
  checked: s.world.checked,
  scores: s.scores,
  lastPoints: s.lastPoints,
  aliveCount: aliveCount(s.world),
});
const options = (s: State) => ({
  statusOf: statusOf(s),
  scores: s.scores,
  deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
});
function tvView(s: State): FlappyTvView {
  return {
    ...envelope(s, manifest.id, options(s)),
    timerMode: 'hidden',
    ...common(s),
    birds: s.world.birds,
    gates: visibleGates(s.world),
  };
}
function controllerView(s: State, id: string): FlappyControllerView {
  const player = hasPlayer(s, id);
  const stage = s.phoneOnly === true || !player || s.players[id]?.canSeeTv === false;
  const mine = s.world.birds.find((b) => b.id === id) ?? null;
  const score = player ? (s.scores[id] ?? 0) : 0;
  const over = player && s.phase.id === 'done';
  const rank = over ? 1 + Object.values(s.scores).filter((v) => v > score).length : null;
  return {
    ...controllerEnvelope(s, manifest.id, id, options(s)),
    ...common(s),
    ...(stage ? { birds: s.world.birds, gates: visibleGates(s.world) } : {}),
    mine,
    slot: s.world.birds.findIndex((b) => b.id === id),
    rank,
    tied:
      over && rank === 1 && Object.entries(s.scores).some(([pid, v]) => pid !== id && v === score),
  };
}
export const game: GameDefinition<State, Input, FlappyTvView, FlappyControllerView> = {
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
