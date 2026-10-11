// A rotating drawing party. The reducer composes pure phase files; views reveal only public data.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  onPlayerEvent,
  pausedFor,
  recheckOnResume,
  seedRng,
  selectSetting,
  shuffle,
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
import { publicMask } from './mask';
import { enterChoose, reduceChoose } from './phases/choose';
import { enterDone } from './phases/done';
import { advanceDraw, allSolved, enterDraw, reduceDraw } from './phases/draw';
import { enterReveal, reduceReveal } from './phases/reveal';
import { results } from './scoring';
import { PHASES, inputSchema } from './types';
import type { Feedback, Input, State, Stroke } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
interface PublicFields {
  turn: number;
  turns: number;
  drawerId: string;
  drawerName: string;
  mask: string;
  strokes: Stroke[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  solvedIds: string[];
  answer: string | null;
}
export interface DrawGuessTvView extends TvView, PublicFields {}
export interface DrawGuessControllerView extends ControllerView, PublicFields {
  isDrawer: boolean;
  choices: string[];
  secret: string | null;
  solved: boolean;
  feedback: Feedback;
  nextSeq: number;
  nextStroke: number;
  stage: boolean;
  rank: number | null;
}

function nextArtist(state: State, now: number, from: number): State {
  let index = from;
  while (index < state.order.length) {
    const id = state.order[index]!;
    if (hasPlayer(state, id) && state.players[id]!.connected && !state.left.includes(id))
      return enterChoose(state, now, index);
    index++;
  }
  return enterDone(state, now);
}
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((player) => [player.id, { ...player }]));
  const settings = {
    rounds: numberSetting(manifest, ctx.settings, 'rounds'),
    seconds: numberSetting(manifest, ctx.settings, 'seconds'),
    difficulty: selectSetting(manifest, ctx.settings, 'difficulty'),
  };
  const [roster, rng] = shuffle(seedRng(ctx.seed), Object.keys(players));
  const base: State = {
    phase: { id: 'choose', startedAt: ctx.now, deadline: null },
    rng,
    players,
    settings,
    order: Array.from({ length: settings.rounds }, () => roster).flat(),
    turnIndex: 0,
    drawerId: '',
    choices: [],
    word: null,
    used: [],
    hintIndices: [],
    hintLevel: 0,
    strokes: [],
    lastSeq: -1,
    lastStroke: -1,
    eligibleAtStart: 0,
    began: ctx.now,
    endsAt: ctx.now,
    checkedAt: ctx.now,
    solved: {},
    guesses: {},
    feedback: {},
    scores: Object.fromEntries(roster.map((id) => [id, 0])),
    lastPoints: {},
    left: [],
    phoneOnly: ctx.presence?.phoneOnly === true,
  };
  return nextArtist(base, ctx.now, 0);
}
function closeIfDone(state: State, now: number): State {
  if (state.phase.id !== 'choose' && state.phase.id !== 'draw') return state;
  const drawer = state.players[state.drawerId];
  if (!drawer?.connected || state.left.includes(state.drawerId)) return enterReveal(state, now);
  return state.phase.id === 'draw' && allSolved(state) ? enterReveal(state, now) : state;
}
function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'choose':
      return closeIfDone(enterDraw(state, now), now);
    case 'draw':
      return advanceDraw(state, now, enterReveal);
    case 'reveal':
      return nextArtist(state, now, state.turnIndex + 1);
    default:
      return state;
  }
}
const reduce = composeReduce<State, Input>({
  phases: { choose: reduceChoose, draw: reduceDraw, reveal: reduceReveal },
  advance,
  skip: (state, now) => (state.phase.id === 'draw' ? enterReveal(state, now) : advance(state, now)),
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone }),
  prepare: (state, event) => {
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'draw')
      return state;
    const ms = pausedFor(state, event.now);
    return ms > 0
      ? {
          ...state,
          began: state.began + ms,
          endsAt: state.endsAt + ms,
          checkedAt: state.checkedAt + ms,
          solved: Object.fromEntries(Object.entries(state.solved).map(([id, at]) => [id, at + ms])),
        }
      : state;
  },
  afterVip: (_before, after, event) => recheckOnResume(after, event, closeIfDone),
});
function publicFields(state: State): PublicFields {
  const revealed = state.phase.id === 'reveal' || state.phase.id === 'done';
  return {
    turn: state.turnIndex + 1,
    turns: state.order.length,
    drawerId: state.drawerId,
    drawerName: state.players[state.drawerId]?.name ?? '',
    mask: state.phase.id === 'draw' ? publicMask(state) : '',
    strokes: state.strokes,
    scores: state.scores,
    lastPoints: state.lastPoints,
    solvedIds: Object.keys(state.solved),
    answer: revealed ? (state.word?.text ?? null) : null,
  };
}
function options(state: State): Parameters<typeof envelope>[2] {
  return {
    scores: state.scores,
    deadline: state.phase.id === 'draw' ? state.endsAt : state.phase.deadline,
    statusOf: (id): PlayerStatus =>
      state.phase.id === 'draw'
        ? Object.hasOwn(state.solved, id)
          ? 'submitted'
          : 'active'
        : 'waiting',
    skipLabel: state.phase.id === 'draw' ? 'Reveal the word' : 'Next artist',
  };
}
function tvView(state: State): DrawGuessTvView {
  return {
    ...envelope(state, manifest.id, options(state)),
    ...publicFields(state),
    timerMode: 'quiet',
  };
}
function controllerView(state: State, playerId: string): DrawGuessControllerView {
  const player = hasPlayer(state, playerId);
  const isDrawer = player && playerId === state.drawerId;
  const mine = player ? (state.scores[playerId] ?? 0) : 0;
  return {
    ...controllerEnvelope(state, manifest.id, playerId, options(state)),
    ...publicFields(state),
    isDrawer,
    choices: isDrawer && state.phase.id === 'choose' ? state.choices.map((word) => word.text) : [],
    secret: isDrawer && state.phase.id === 'draw' ? (state.word?.text ?? null) : null,
    solved: player && Object.hasOwn(state.solved, playerId),
    feedback:
      player && Object.hasOwn(state.feedback, playerId) ? state.feedback[playerId]! : 'none',
    nextSeq: state.lastSeq + 1,
    nextStroke: state.lastStroke + 1,
    stage: state.phoneOnly || !player || state.players[playerId]?.canSeeTv === false,
    rank:
      player && state.phase.id === 'done'
        ? 1 + Object.values(state.scores).filter((total) => total > mine).length
        : null,
  };
}
export const game: GameDefinition<State, Input, DrawGuessTvView, DrawGuessControllerView> = {
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
