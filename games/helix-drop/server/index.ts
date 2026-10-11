// The host owns time/networking; this definition only transforms JSON state and views.
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
import { freshRunner, makeTower } from './content';
import { enterDone } from './phases/done';
import { advancePlay, enterPlay, reducePlay } from './phases/play';
import { enterReveal, reduceReveal } from './phases/reveal';
import { results, scoresOf } from './scoring';
import { inputSchema, PHASES } from './types';
import type { Input, Ring, Runner, State } from './types';
import { settle } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
export interface Lane {
  id: string;
  slot: number;
  angle: number;
  y: number;
  floor: number;
  best: number;
  chain: number;
  lives: number;
  recovering: boolean;
  cleared: boolean;
  rings: (Ring & { index: number })[];
}
export interface HelixTvView extends TvView {
  lanes: Lane[];
  scores: Record<string, number>;
  winnerIds: string[];
}
export interface HelixControllerView extends ControllerView {
  lane: Lane | null;
  lanes?: Lane[];
  scores: Record<string, number>;
  rank: number;
  winnerIds: string[];
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const lives = numberSetting(manifest, ctx.settings, 'lives');
  const [tower, rng] = makeTower(seedRng(ctx.seed));
  return enterPlay(
    {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      players,
      rng,
      tower,
      runners: ctx.players.map((p) => freshRunner(p.id, lives)),
      began: ctx.now,
      endsAt: ctx.now,
      checked: 0,
      phoneOnly: ctx.presence?.phoneOnly ?? false,
      settings: { lives },
    },
    ctx.now,
  );
}

const advance = (state: State, now: number): State => {
  if (state.phase.id === 'play') return advancePlay(state, now, enterReveal);
  if (state.phase.id === 'reveal') return enterDone(state, now);
  return state;
};

const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, reveal: reduceReveal },
  advance: (s, now) => (s.phase.id === 'play' ? enterReveal(s, now) : advance(s, now)),
  skip: (s, now) => (s.phase.id === 'play' ? enterReveal(settle(s, now), now) : advance(s, now)),
  end: (s, now) => enterDone(s.phase.id === 'play' && !s.phase.paused ? settle(s, now) : s, now),
  onPlayer: (s, event) => {
    const next = setConnected(s, event);
    return event.connected || !hasPlayer(s, event.playerId)
      ? next
      : {
          ...next,
          runners: next.runners.map((r) =>
            r.id === event.playerId ? { ...r, dir: 0, heldUntil: 0 } : r,
          ),
        };
  },
  prepare: (s, event) => {
    if (s.phase.id !== 'play' || event.type !== 'vip') return s;
    if (event.action === 'pause' && !s.phase.paused) return settle(s, event.now);
    if (event.action !== 'resume') return s;
    const ms = pausedFor(s, event.now);
    if (ms <= 0) return s;
    return {
      ...s,
      began: s.began + ms,
      endsAt: s.endsAt + ms,
      runners: s.runners.map((r) => ({ ...r, dir: 0, heldUntil: 0 })),
    };
  },
});

function laneOf(state: State, runner: Runner, slot: number): Lane {
  const start = Math.max(0, Math.min(state.tower.length - 3, runner.floor));
  return {
    id: runner.id,
    slot,
    angle: runner.angle,
    y: runner.y,
    floor: runner.floor,
    best: runner.best,
    chain: runner.chain,
    lives: runner.lives,
    recovering: runner.respawnAt !== null,
    cleared: runner.cleared,
    rings: state.tower.slice(start, start + 3).map((r, i) => ({ ...r, index: start + i })),
  };
}

function publicMatch(state: State): { scores: Record<string, number>; winnerIds: string[] } {
  const scores = scoresOf(state);
  const top = Math.max(0, ...Object.values(scores));
  return {
    scores,
    winnerIds:
      state.phase.id === 'play' ? [] : state.runners.filter((r) => r.best === top).map((r) => r.id),
  };
}
const options = (s: State) => ({
  deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
  statusOf: (id: string) =>
    s.phase.id === 'play' && s.runners.some((r) => r.id === id && r.lives > 0 && !r.cleared)
      ? ('active' as const)
      : ('waiting' as const),
  scores: scoresOf(s),
});

export const game: GameDefinition<State, Input, HelixTvView, HelixControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  results,
  tvView(s) {
    return {
      ...envelope(s, manifest.id, options(s)),
      timerMode: 'hidden',
      ...publicMatch(s),
      lanes: s.runners.map((r, i) => laneOf(s, r, i)),
    };
  },
  controllerView(s, id) {
    const slot = s.runners.findIndex((r) => r.id === id);
    const runner = s.runners[slot];
    const stage = s.phoneOnly || (hasPlayer(s, id) && s.players[id]?.canSeeTv === false);
    return {
      ...controllerEnvelope(s, manifest.id, id, options(s)),
      phoneOnly: stage,
      ...publicMatch(s),
      lane: runner ? laneOf(s, runner, slot) : null,
      rank: runner ? 1 + s.runners.filter((r) => r.best > runner.best).length : 0,
      ...(stage || !hasPlayer(s, id) ? { lanes: s.runners.map((r, i) => laneOf(s, r, i)) } : {}),
    };
  },
  bot: { sampleInput: botInput },
};
