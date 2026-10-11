// Quick Poll — the template game. `game` is what the registry imports. One file per phase under
// ./phases; this file only wires init / reduce / views / results / bot together.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  playerName,
  seedRng,
} from '@partybox/game-sdk';
import type { ControllerView, GameDefinition, InitContext, TvView } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { WORDS } from './content';
import { enterAnswer, reduceAnswer } from './phases/answer';
import { enterDone, enterReveal, reduceReveal } from './phases/reveal';
import { results } from './scoring';
import { PHASES, inputSchema } from './types';
import type { Input, State } from './types';

// Parsed once: a typo in manifest.json fails at import time instead of deep inside the engine.
const manifest = gameManifestSchema.parse(manifestJson);

export interface QuickPollTvView extends TvView {
  prompt: string;
  /** Only filled from `reveal` on; the TV never spoils answers early. */
  answers: { playerId: string; name: string; text: string }[];
  answeredCount: number;
  totalCount: number;
}

export interface QuickPollControllerView extends ControllerView {
  prompt: string;
  submitted: boolean;
  myAnswer: string | null;
}

function init(ctx: InitContext): State {
  const players: State['players'] = {};
  for (const p of ctx.players) players[p.id] = p;
  const base: State = {
    phase: { id: 'answer', startedAt: ctx.now, deadline: null },
    rng: seedRng(ctx.seed),
    players,
    prompt: WORDS.prompt,
    answers: {},
    scores: {},
    settings: { answerSeconds: numberSetting(manifest, ctx.settings, 'answerSeconds') },
  };
  return enterAnswer(base, ctx.now);
}

/** The phase order. What a deadline does — and what a VIP skip does (docs/GAME_CONTRACT.md). */
export function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'answer':
      return enterReveal(state, now);
    case 'reveal':
      return enterDone(state, now);
    default:
      return state;
  }
}

// The SDK's skeleton: player → speech → VIP → paused → the phase on stage. VIP skip = the phase's
// normal exit (`advance`); VIP end always jumps to done; pause/resume shift the deadline, and while
// paused inputs and timers wait. A game with readings adds `onSpeech`; one that waits on everyone,
// `onPlayer` through `onPlayerEvent` (docs/GAME_CONTRACT.md).
const reduce = composeReduce<State, Input>({
  phases: { answer: reduceAnswer, reveal: reduceReveal },
  advance,
  end: enterDone,
});

function statusOf(state: State): (id: string) => 'active' | 'submitted' | 'waiting' {
  return (id) =>
    id in state.answers ? 'submitted' : state.phase.id === 'answer' ? 'active' : 'waiting';
}

function tvView(state: State): QuickPollTvView {
  const revealed = state.phase.id !== 'answer';
  return {
    ...envelope(state, manifest.id, {
      statusOf: statusOf(state),
      scores: revealed ? state.scores : undefined,
    }),
    prompt: state.prompt,
    answers: revealed
      ? Object.entries(state.answers).map(([playerId, text]) => ({
          playerId,
          name: playerName(state.players, playerId),
          text,
        }))
      : [],
    answeredCount: Object.keys(state.answers).length,
    totalCount: Object.values(state.players).filter((p) => p.connected).length,
  };
}

function controllerView(state: State, playerId: string): QuickPollControllerView {
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    prompt: state.prompt,
    submitted: playerId in state.answers,
    myAnswer: state.answers[playerId] ?? null,
  };
}

// The view generics make `game.tvView(state).answers` type-check in tests and client code.
export const game: GameDefinition<State, Input, QuickPollTvView, QuickPollControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: {
    sampleInput(state, playerId, rng) {
      if (state.phase.id !== 'answer' || !hasPlayer(state, playerId) || playerId in state.answers)
        return null;
      return { type: 'answer', text: rng.pick(WORDS.words) };
    },
  },
};
