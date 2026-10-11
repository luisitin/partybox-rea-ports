// Game wiring: deterministic turns, private words, public ink and resumable clocks.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  selectSetting,
  seedRng,
  shuffle,
  onPlayerEvent,
  recheckOnResume,
  pausedFor,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterChoose, reduceChoose } from './phases/choose';
import { enterDraw, reduceDraw, maskedWord, allSolved, guessers } from './phases/draw';
import { enterReveal, reduceReveal } from './phases/reveal';
import { enterDone } from './phases/done';
import { results } from './scoring';
import { PHASES, inputSchema } from './types';
import type { State, Input, DrawTvView, DrawControllerView, PublicBoard } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const [rotation, rng] = shuffle(
    seedRng(ctx.seed),
    ctx.players.map((p) => p.id),
  );
  const laps = numberSetting(manifest, ctx.settings, 'laps');
  const base: State = {
    phase: { id: 'choose', startedAt: ctx.now, deadline: null },
    players,
    rng,
    order: Array.from({ length: laps }, () => rotation).flat(),
    turn: 0,
    drawer: '',
    choices: [],
    word: '',
    strokes: [],
    inkRevision: 0,
    solved: {},
    guesses: {},
    feedback: {},
    lastGuessAt: {},
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    gains: {},
    used: [],
    began: ctx.now,
    endsAt: ctx.now,
    clock: ctx.now,
    hintOrder: [],
    hintCount: 0,
    left: [],
    phoneOnly: ctx.presence?.phoneOnly === true,
    settings: {
      laps,
      drawSeconds: numberSetting(manifest, ctx.settings, 'drawSeconds'),
      difficulty: selectSetting(manifest, ctx.settings, 'difficulty'),
    },
  };
  return nextTurn(base, ctx.now, 0);
}
function nextTurn(state: State, now: number, from: number): State {
  if (
    Object.values(state.players).filter((p) => p.connected && !state.left.includes(p.id)).length < 2
  )
    return enterDone(state, now);
  for (let turn = from; turn < state.order.length; turn++) {
    const id = state.order[turn] ?? '';
    if (state.players[id]?.connected && !state.left.includes(id))
      return enterChoose(state, now, turn);
  }
  return enterDone(state, now);
}
export function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'choose':
      return closeIfDone(enterDraw(state, now), now);
    case 'draw':
      return enterReveal(state, now);
    case 'reveal':
      return nextTurn(state, now, state.turn + 1);
    default:
      return state;
  }
}
function closeIfDone(state: State, now: number): State {
  if (state.phase.paused) return state;
  const artistAway = !state.players[state.drawer]?.connected || state.left.includes(state.drawer);
  if (state.phase.id === 'choose' && artistAway) return nextTurn(state, now, state.turn + 1);
  if (state.phase.id === 'draw' && artistAway) return enterReveal(state, now);
  return state.phase.id === 'draw' && allSolved(state) ? enterReveal(state, now) : state;
}
const reduce = composeReduce<State, Input>({
  phases: { choose: reduceChoose, draw: reduceDraw, reveal: reduceReveal },
  advance,
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone }),
  prepare: (state, event) => {
    if (event.type !== 'vip' || event.action !== 'resume') return state;
    const shift = pausedFor(state, event.now);
    if (!shift) return state;
    return {
      ...state,
      began: state.began + shift,
      endsAt: state.endsAt + shift,
      clock: state.clock + shift,
      lastGuessAt: Object.fromEntries(
        Object.entries(state.lastGuessAt).map(([id, at]) => [id, at + shift]),
      ),
    };
  },
  afterVip: (_before, after, event) => recheckOnResume(after, event, closeIfDone),
});
function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) => {
    if (state.phase.id === 'choose') return id === state.drawer ? 'active' : 'waiting';
    if (state.phase.id !== 'draw') return 'waiting';
    return Object.hasOwn(state.solved, id) ? 'submitted' : 'active';
  };
}
function nextArtistName(state: State): string | undefined {
  if (
    state.phase.id !== 'reveal' ||
    Object.values(state.players).filter((p) => p.connected && !state.left.includes(p.id)).length < 2
  )
    return undefined;
  const id = state.order
    .slice(state.turn + 1)
    .find((candidate) => state.players[candidate]?.connected && !state.left.includes(candidate));
  return id === undefined ? undefined : state.players[id]?.name;
}
function publicBoard(state: State): PublicBoard {
  const revealed = state.phase.id === 'reveal' || state.phase.id === 'done';
  const nextName = nextArtistName(state);
  return {
    turn: state.turn + 1,
    turns: state.order.length,
    drawer: state.drawer,
    drawerName: state.players[state.drawer]?.name ?? 'The artist',
    ...(nextName === undefined ? {} : { nextArtistName: nextName }),
    mask: state.phase.id === 'draw' ? maskedWord(state) : '',
    ...(revealed && state.word ? { answer: state.word } : {}),
    strokes: state.strokes,
    inkRevision: state.inkRevision,
    scores: state.scores,
    gains: revealed ? state.gains : {},
    solvedIds: Object.keys(state.solved),
    solvedCount: Object.keys(state.solved).length,
    guesserCount: new Set([...guessers(state), ...Object.keys(state.solved)]).size,
    endsAt: state.endsAt,
    hintCount: state.hintCount,
  };
}
function tvView(state: State): DrawTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state), scores: state.scores }),
    deadline: state.phase.id === 'draw' ? state.endsAt : state.phase.deadline,
    timerMode: 'quiet',
    ...publicBoard(state),
  };
}
function controllerView(state: State, playerId: string): DrawControllerView {
  const player = hasPlayer(state, playerId);
  const isDrawer = player && playerId === state.drawer;
  const drawing = state.phase.id === 'draw';
  const solved = Object.hasOwn(state.solved, playerId);
  const phoneStage = state.phoneOnly || (player && state.players[playerId]?.canSeeTv === false);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, {
      statusOf: statusOf(state),
      scores: state.scores,
    }),
    deadline: drawing ? state.endsAt : state.phase.deadline,
    ...publicBoard(state),
    isDrawer,
    ...(isDrawer && state.phase.id === 'choose' ? { choices: state.choices } : {}),
    ...(isDrawer && drawing ? { secret: state.word } : {}),
    solved,
    myPoints: player ? (state.solved[playerId] ?? 0) : 0,
    feedback: player ? (state.feedback[playerId] ?? '') : '',
    lastGuess: player && !solved ? (state.guesses[playerId]?.at(-1) ?? '') : '',
    phoneStage,
    canGuess:
      drawing &&
      player &&
      !isDrawer &&
      !solved &&
      !!state.players[playerId]?.connected &&
      !state.left.includes(playerId),
  };
}
export const game: GameDefinition<State, Input, DrawTvView, DrawControllerView> = {
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
