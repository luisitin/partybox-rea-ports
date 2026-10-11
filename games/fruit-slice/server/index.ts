// Fruit Slice: pure simultaneous swiping; SDK owns event ordering and pause controls.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  pausedFor,
  seedRng,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, freshSeat, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { results } from './scoring';
import { PHASES, ROUND_MS, TICK_MS } from './types';
import type { Input, Row, SliceControllerView, SliceTvView, State } from './types';
import { inputSchema, makeWave, targetsAt } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const [fruit, rng] = makeWave(seedRng(ctx.seed), 0);
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    rng,
    players: Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }])),
    began: ctx.now,
    endsAt: ctx.now + ROUND_MS,
    checked: 0,
    wave: 0,
    fruit,
    seats: Object.fromEntries(ctx.players.map((p) => [p.id, freshSeat()])),
    phoneOnly: ctx.presence?.phoneOnly === true,
  };
}
const advance = (state: State, now: number): State =>
  state.phase.id === 'play'
    ? advancePlay(state, now, enterScore)
    : state.phase.id === 'score'
      ? enterDone(state, now)
      : state;
const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, score: reduceScore },
  advance,
  end: enterDone,
  skip: (state, now) =>
    state.phase.id === 'play' ? enterScore(settle(state, now), now) : advance(state, now),
  prepare: (state, event) => {
    if (state.phase.id !== 'play' || event.type !== 'vip') return state;
    if (event.action === 'pause' && !state.phase.paused) return settle(state, event.now);
    if (event.action !== 'resume') return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms, endsAt: state.endsAt + ms } : state;
  },
});
const statusOf = (state: State) => (): PlayerStatus =>
  state.phase.id === 'play' ? 'active' : 'waiting';
function rows(state: State): Row[] {
  return Object.entries(state.seats).map(([id, seat]) => ({
    id,
    name: state.players[id]!.name,
    score: seat.score,
    streak: seat.streak,
    bestCombo: seat.bestCombo,
    bombed: seat.bombed,
  }));
}
const deadline = (state: State): number | null =>
  state.phase.id === 'play' ? state.endsAt : state.phase.deadline;
const seconds = (state: State): number => Math.max(0, Math.ceil((ROUND_MS - state.checked) / 1000));
function tvView(state: State): SliceTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    deadline: deadline(state),
    timerMode: 'hidden',
    wave: state.wave,
    frame: state.checked,
    targets: targetsAt(state.fruit, state.checked, state.wave),
    rows: rows(state),
    seconds: seconds(state),
  };
}
function controllerView(state: State, id: string): SliceControllerView {
  const seat = hasPlayer(state, id) ? state.seats[id]! : freshSeat();
  const stage = state.phoneOnly || (hasPlayer(state, id) && state.players[id]?.canSeeTv === false);
  return {
    ...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }),
    deadline: deadline(state),
    timerMode: 'hidden',
    wave: state.wave,
    frame: state.checked,
    targets: targetsAt(state.fruit, state.checked, state.wave).filter(
      (f) => !seat.cut.includes(f.id),
    ),
    rows: rows(state),
    seconds: seconds(state),
    score: seat.score,
    streak: seat.streak,
    bestCombo: seat.bestCombo,
    bombed: seat.bombed,
    lastSeq: seat.lastSeq,
    feedback: seat.feedback,
    feedbackPoints: seat.feedbackPoints,
    stage,
  };
}
export const game: GameDefinition<State, Input, SliceTvView, SliceControllerView> = {
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
