// Word Guess Race: three independent shared puzzles, private letter histories and public progress.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  onPlayerEvent,
  pausedFor,
  rankPlayers,
  recheckOnResume,
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
import { drawAnswers } from './content';
import { enterDone } from './phases/done';
import { closeIfDone, enterGuess, inputSchema, reduceGuess } from './phases/guess';
import { enterReveal, reduceReveal } from './phases/reveal';
import { results } from './scoring';
import { emptyEntry, finished, PHASES, ROUNDS } from './types';
import type { Guess, Input, PublicGrid, State } from './types';

const manifest = gameManifestSchema.parse(manifestJson);

interface MatchView {
  round: number;
  rounds: number;
  grids: PublicGrid[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  ranks: Record<string, number>;
  solution: string | null;
}

export interface WordGuessTvView extends TvView, MatchView {}

export interface WordGuessControllerView extends ControllerView, MatchView {
  guesses: Guess[];
  error: string | null;
  submissionVersion: number;
  stage: boolean;
  rank: number | null;
  solved: boolean;
  finished: boolean;
}

function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((player) => [player.id, { ...player }]));
  const [answers, rng] = drawAnswers(seedRng(ctx.seed));
  const scores = Object.fromEntries(ctx.players.map((player) => [player.id, 0]));
  const base: State = {
    phase: { id: 'guess', startedAt: ctx.now, deadline: null },
    rng,
    players,
    round: 1,
    answers,
    began: ctx.now,
    settings: { roundSeconds: numberSetting(manifest, ctx.settings, 'roundSeconds') },
    entries: {},
    scores,
    lastPoints: { ...scores },
    roundScored: false,
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
  };
  return enterGuess(base, ctx.now, 1);
}

export function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'guess':
      return enterReveal(state, now);
    case 'reveal':
      return state.round >= ROUNDS
        ? enterDone(state, now)
        : enterGuess(state, now, state.round + 1);
    default:
      return state;
  }
}

const close = (state: State, now: number): State => closeIfDone(state, now, enterReveal);
const reduce = composeReduce<State, Input>({
  phases: { guess: reduceGuess, reveal: reduceReveal },
  advance,
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone: close }),
  prepare: (state, event) => {
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'guess')
      return state;
    const ms = pausedFor(state, event.now);
    return ms > 0 ? { ...state, began: state.began + ms } : state;
  },
  afterVip: (_before, after, event) => recheckOnResume(after, event, close),
});

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id !== 'guess'
      ? 'waiting'
      : finished(state.entries[id] ?? emptyEntry())
        ? 'submitted'
        : 'active';

function matchView(state: State): MatchView {
  return {
    round: state.round,
    rounds: ROUNDS,
    grids: Object.keys(state.players).map((id) => {
      const entry = state.entries[id] ?? emptyEntry();
      return {
        id,
        rows: entry.guesses.map((guess) => [...guess.marks]),
        solved: entry.solvedElapsedMs !== null,
        finished: state.phase.id !== 'guess' || finished(entry),
        elapsedMs: entry.solvedElapsedMs,
      };
    }),
    scores: { ...state.scores },
    lastPoints: { ...state.lastPoints },
    ranks: Object.fromEntries(
      rankPlayers(state, state.scores).map((row) => [row.playerId, row.rank]),
    ),
    solution: state.phase.id === 'guess' ? null : (state.answers[state.round - 1] ?? null),
  };
}

function tvView(state: State): WordGuessTvView {
  return {
    ...envelope(state, manifest.id, { scores: state.scores, statusOf: statusOf(state) }),
    timerMode: 'hidden',
    ...matchView(state),
  };
}

function controllerView(state: State, playerId: string): WordGuessControllerView {
  const known = hasPlayer(state, playerId);
  const entry = known ? (state.entries[playerId] ?? emptyEntry()) : emptyEntry();
  const shared = matchView(state);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, {
      scores: state.scores,
      statusOf: statusOf(state),
    }),
    ...shared,
    guesses: entry.guesses.map((guess) => ({ word: guess.word, marks: [...guess.marks] })),
    error: entry.error,
    submissionVersion: entry.submissionVersion,
    stage: !known || state.phoneOnly === true || state.players[playerId]?.canSeeTv === false,
    rank: known ? (shared.ranks[playerId] ?? null) : null,
    solved: entry.solvedElapsedMs !== null,
    finished: !known || state.phase.id !== 'guess' || finished(entry),
  };
}

export const game: GameDefinition<State, Input, WordGuessTvView, WordGuessControllerView> = {
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
