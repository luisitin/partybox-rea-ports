// One public pitch, private input bookkeeping, and two wall-clock halves.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  onPlayerEvent,
  pausedFor,
  seedRng,
  shuffle,
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
import { centerBall, formation, TEAM_NAMES } from './content';
import { enterDone } from './phases/done';
import { enterGoal, reduceGoal } from './phases/goal';
import { enterHalftime, reduceHalftime } from './phases/halftime';
import { enterPlay, reducePlay, settlePlay } from './phases/play';
import { results, scores } from './scoring';
import { GOAL_MS, PHASES, inputSchema, neutral } from './types';
import type { Body, Disc, Goal, Input, State, Team } from './types';
import { resetPitch } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
export interface DiscView extends Body {
  id: string;
  name: string;
  team: Team;
  number: number;
  helper: boolean;
  connected: boolean;
  departed: boolean;
}
interface MatchView {
  half: 1 | 2;
  halfSeconds: number;
  goals: Record<Team, number>;
  redAttacksRight: boolean;
  ball: Body;
  discs: DiscView[];
  lastGoal: Goal | null;
}
export interface HaxballTvView extends TvView, MatchView {}
export interface HaxballControllerView extends ControllerView, MatchView {
  team: Team | null;
  number: number | null;
  departed: boolean;
  acceptedSeq: number;
  kickHeld: boolean;
  kickArmed: boolean;
  kickReadyAt: number;
  lastKickAt: number | null;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((player) => [player.id, { ...player }]));
  const [roster, rng] = shuffle(
    seedRng(ctx.seed),
    ctx.players.map((player) => player.id),
  );
  const teams: Record<string, Team> = Object.fromEntries(
    roster.map((id, i) => [id, i % 2 === 0 ? 'red' : 'blue']),
  );
  const discs: Disc[] = roster.map((id, i) => ({
    id,
    team: teams[id]!,
    number: Math.floor(i / 2) + 1,
    helper: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));
  if (roster.length % 2 === 1 && roster.length > 1) {
    let id = 'haxball-helper';
    while (Object.hasOwn(players, id)) id += '-helper';
    discs.push({
      id,
      team: 'blue',
      number: Math.ceil(roster.length / 2),
      helper: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    });
  }
  const halfSeconds = numberSetting(manifest, ctx.settings, 'halfSeconds');
  const state: State = {
    phase: { id: 'play', startedAt: ctx.now, deadline: null },
    rng,
    players,
    half: 1,
    halfSeconds,
    clock: ctx.now,
    simAt: ctx.now,
    halfEndsAt: ctx.now + halfSeconds * 1000,
    teams,
    goals: { red: 0, blue: 0 },
    discs: formation(discs, true),
    ball: centerBall(),
    intents: Object.fromEntries(discs.map((disc) => [disc.id, neutral()])),
    redAttacksRight: true,
    lastGoal: null,
    lastTouch: null,
    left: [],
    phoneOnly: ctx.presence?.phoneOnly === true,
  };
  return connectedCount(state) === 0 ? enterDone(state, ctx.now) : enterPlay(state, ctx.now);
}

const connectedCount = (state: State): number =>
  Object.values(state.players).filter(
    (player) => player.connected && !state.left.includes(player.id),
  ).length;
const endHalf = (state: State, now: number): State =>
  state.half === 1 ? enterHalftime(state, now) : enterDone(state, now);
function advance(state: State, now: number): State {
  if (state.phase.id === 'play') return endHalf(state, now);
  if (state.phase.id === 'goal')
    return now >= state.halfEndsAt ? endHalf(state, now) : enterPlay(state, now);
  if (state.phase.id === 'halftime') {
    const next = resetPitch(
      {
        ...state,
        half: 2,
        redAttacksRight: !state.redAttacksRight,
        halfEndsAt: now + state.halfSeconds * 1000,
        clock: now,
      },
      now,
    );
    return enterPlay(next, now);
  }
  return state;
}
/** Consume past transitions at their judged times; delayed events cannot stretch the match. */
function settle(state: State, now: number): State {
  let current = state;
  const maximum = Math.ceil((state.halfSeconds * 2000) / GOAL_MS) * 2 + 8;
  for (let n = 0; n < maximum; n++) {
    if (current.phase.id === 'done') break;
    if (current.phase.id === 'play') {
      const after = settlePlay(current, now, endHalf, enterGoal);
      const samePlay =
        after.phase.id === 'play' && after.phase.startedAt === current.phase.startedAt;
      current = after;
      if (samePlay) break;
      continue;
    }
    const deadline = current.phase.deadline;
    if (deadline === null || deadline > now) break;
    current = advance(current, deadline);
  }
  return { ...current, clock: now };
}
function skip(state: State, now: number): State {
  const judged = settle(state, now);
  if (
    state.phase.id === 'play' &&
    judged.half === state.half &&
    (judged.phase.id === 'play' || judged.phase.id === 'goal')
  )
    return endHalf(judged, now);
  if (
    (state.phase.id === 'goal' || state.phase.id === 'halftime') &&
    judged.phase.id === state.phase.id &&
    judged.phase.startedAt === state.phase.startedAt
  )
    return advance(judged, now);
  // An elapsed transition already satisfied the old screen's skip; never skip its successor.
  return judged;
}

const composed = composeReduce<State, Input>({
  phases: {
    play: (state, event) => reducePlay(state, event, settle),
    goal: (state, event) => reduceGoal(state, event, settle),
    halftime: (state, event) => reduceHalftime(state, event, settle),
  },
  advance,
  // Goal skip resumes the current half; play skip ends that half.
  skip,
  end: (state, now) => enterDone(state.phase.paused ? state : settle(state, now), now),
  onPlayer: (state, event) => {
    if (!hasPlayer(state, event.playerId)) return state;
    if (
      state.players[event.playerId]!.connected === event.connected &&
      (!event.gone || state.left.includes(event.playerId))
    )
      return state;
    const before = state.phase.paused ? state : settle(state, event.now);
    const after = onPlayerEvent(before, event);
    const id = event.playerId;
    const changed = {
      ...after,
      clock: event.now,
      intents: { ...after.intents, [id]: neutral(after.intents[id]) },
      discs: after.discs.map((disc) => (disc.id === id ? { ...disc, vx: 0, vy: 0 } : disc)),
    };
    return connectedCount(changed) === 0 ? enterDone(changed, event.now) : changed;
  },
  prepare: (state, event) => {
    if (event.type !== 'vip') return state;
    if (event.action === 'pause' && !state.phase.paused) {
      const held = settle(state, event.now);
      // The phone cancels held pointers on pause; its neutral packet may arrive after the guard.
      return {
        ...held,
        clock: event.now,
        intents: Object.fromEntries(
          Object.entries(held.intents).map(([id, intent]) => [id, neutral(intent)]),
        ),
      };
    }
    if (event.action !== 'resume' || !state.phase.paused) return state;
    const ms = pausedFor(state, event.now);
    return {
      ...state,
      clock: event.now,
      simAt: state.simAt + ms,
      halfEndsAt: state.halfEndsAt + ms,
      intents: Object.fromEntries(
        Object.entries(state.intents).map(([id, intent]) => [
          id,
          {
            ...intent,
            until: intent.until > 0 ? intent.until + ms : 0,
            kickReadyAt: intent.kickReadyAt > 0 ? intent.kickReadyAt + ms : 0,
          },
        ]),
      ),
    };
  },
  afterVip: (_before, after, event) => {
    const now = event.now;
    if (connectedCount(after) === 0) return enterDone(after, now);
    if (
      event.type === 'vip' &&
      event.action === 'resume' &&
      (after.phase.id === 'play' || after.phase.id === 'goal') &&
      now >= after.halfEndsAt
    )
      return endHalf(after, now);
    return { ...after, clock: now };
  },
});
function reduce(state: State, event: GameEvent<Input>): State {
  if (!Number.isFinite(event.now) || event.now < state.clock) return state;
  return composed(state, event);
}

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id === 'play' && state.players[id]?.connected && !state.left.includes(id)
      ? 'active'
      : 'waiting';
function common(state: State): MatchView {
  return {
    half: state.half,
    halfSeconds: state.halfSeconds,
    goals: { ...state.goals },
    redAttacksRight: state.redAttacksRight,
    ball: { ...state.ball },
    discs: state.discs.map((disc) => ({
      ...disc,
      name: disc.helper
        ? `${TEAM_NAMES[disc.team]} Helper`
        : (state.players[disc.id]?.name ?? disc.id),
      connected: disc.helper
        ? connectedCount(state) > 0
        : !!state.players[disc.id]?.connected && !state.left.includes(disc.id),
      departed: !disc.helper && state.left.includes(disc.id),
    })),
    lastGoal: state.lastGoal ? { ...state.lastGoal } : null,
  };
}
const visibleDeadline = (state: State): number | null =>
  state.phase.id === 'play' || state.phase.id === 'goal' ? state.halfEndsAt : state.phase.deadline;
function tvView(state: State): HaxballTvView {
  return {
    ...envelope(state, manifest.id, {
      statusOf: statusOf(state),
      scores: scores(state),
      deadline: visibleDeadline(state),
      skipLabel:
        state.phase.id === 'goal'
          ? 'Resume this half'
          : state.phase.id === 'play'
            ? 'End this half'
            : state.phase.id === 'halftime'
              ? 'Start second half'
              : undefined,
    }),
    ...common(state),
    timerMode: 'hidden',
  };
}
function controllerView(state: State, id: string): HaxballControllerView {
  const player = hasPlayer(state, id);
  const disc = player ? state.discs.find((other) => other.id === id) : undefined;
  const intent = player ? state.intents[id] : undefined;
  const departed = player && state.left.includes(id);
  return {
    ...controllerEnvelope(state, manifest.id, id, {
      statusOf: statusOf(state),
      scores: scores(state),
      deadline: visibleDeadline(state),
      screen: departed ? 'departed' : `${state.phase.id}-${state.half}`,
    }),
    ...common(state),
    team: disc?.team ?? null,
    number: disc?.number ?? null,
    departed,
    acceptedSeq: intent?.seq ?? -1,
    kickHeld:
      !!intent?.kickHeld && intent.until > state.clock && state.phase.id === 'play' && !departed,
    kickArmed:
      !!intent?.kickArmed && intent.until > state.clock && state.phase.id === 'play' && !departed,
    kickReadyAt: intent?.kickReadyAt ?? 0,
    lastKickAt: intent?.lastKickAt ?? null,
  };
}
export const game: GameDefinition<State, Input, HaxballTvView, HaxballControllerView> = {
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
