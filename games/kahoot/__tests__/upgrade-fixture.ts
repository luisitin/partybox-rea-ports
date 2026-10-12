// An original injected toy game; no Lightning Round implementation is included in this payload.
import {
  buildResults,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  seedRng,
  z,
} from '@partybox/game-sdk';
import type {
  BotAsk,
  BotSkill,
  GameDefinition,
  GameEvent,
  GameStateBase,
  InitContext,
  RecapContext,
  Rng,
  Settings,
  SpeechRequest,
  TvView,
  ControllerView,
} from '@partybox/game-sdk';

export interface ClassicState extends GameStateBase {
  marker: number;
  secret: string;
}
export interface ClassicInput {
  type: 'pick';
  value: number;
}
export interface ClassicTv extends TvView {
  marker: number;
}
export interface ClassicPhone extends ControllerView {
  marker: number;
  secret?: string;
}
export function makeClassic() {
  const seen: {
    init?: InitContext;
    reduce?: { state: ClassicState; event: GameEvent<ClassicInput> };
    bot?: { state: ClassicState; rng: Rng; skill?: BotSkill };
    recap?: { state: ClassicState; ctx: RecapContext<ClassicState> };
    stage?: Settings;
    ask?: ClassicState;
    answer?: ClassicState;
  } = {};
  const options = ['one', 'two'];
  const readings: SpeechRequest[] = [
    { key: 'classic-voice', voice: 'original', parts: [{ text: 'Classic question' }] },
  ];
  const ask: BotAsk = { prompt: 'Choose a number.' };
  const manifest = gameManifestSchema.parse({
    id: 'existing-quiz',
    name: 'Existing quiz',
    icon: '⚡',
    tagline: 'Existing default quiz.',
    description: 'An original delegation fixture.',
    howToPlay: ['Read the question.', 'Choose an answer.', 'Keep your existing finale.'],
    version: '1.0.0',
    minPlayers: 1,
    maxPlayers: 16,
    estimatedMinutes: 8,
    estimate: {
      fixedSeconds: 25,
      perRoundSeconds: 24,
      perPlayerPerRoundSeconds: 1,
      roundsSetting: 'questions',
    },
    category: 'classics',
    tags: ['trivia'],
    presence: { needs: 'anywhere' },
    addedOn: '2026-10-11',
    contentLangs: ['en', 'es'],
    supportsBots: true,
    settings: [
      {
        key: 'questions',
        label: 'Questions',
        type: 'number',
        default: 10,
        min: 5,
        max: 20,
        step: 1,
      },
      {
        key: 'answerSeconds',
        label: 'Answer seconds',
        type: 'number',
        default: 15,
        min: 5,
        max: 30,
        step: 5,
      },
    ],
    minigame: {
      modes: ['ffa', 'duel'],
      seconds: 100,
      settings: { questions: 4, answerSeconds: 5 },
      controls: ['Pick an answer'],
      howTo: ['Read the question.', 'Pick your answer.'],
      practice: false,
    },
  });
  const game: GameDefinition<ClassicState, ClassicInput, ClassicTv, ClassicPhone> = {
    manifest,
    phases: ['classic', 'done'],
    inputSchema: z
      .object({ type: z.literal('pick'), value: z.number().int().min(0).max(3) })
      .strict(),
    init: (ctx) => {
      seen.init = ctx;
      return {
        phase: { id: 'classic', startedAt: ctx.now, deadline: ctx.now + 1_000 },
        rng: seedRng(ctx.seed),
        players: Object.fromEntries(ctx.players.map((p) => [p.id, p])),
        marker: 0,
        secret: 'hidden classic answer',
      };
    },
    reduce: (state, event) => {
      seen.reduce = { state, event };
      if (event.type === 'input')
        return event.input.value ? { ...state, marker: state.marker + event.input.value } : state;
      if (event.type === 'vip' && event.action === 'end')
        return { ...state, phase: { id: 'done', startedAt: event.now, deadline: null } };
      return state;
    },
    tvView: (state) => ({ ...envelope(state, manifest.id), marker: state.marker }),
    controllerView: (state, id) => ({
      ...controllerEnvelope(state, manifest.id, id),
      marker: state.marker,
      ...(id === 'p1' ? { secret: state.secret } : {}),
    }),
    results: (state) =>
      state.phase.id === 'done'
        ? buildResults(
            state,
            Object.fromEntries(Object.keys(state.players).map((id) => [id, state.marker])),
          )
        : null,
    bot: {
      sampleInput: (state, _id, rng, skill) => {
        seen.bot = { state, rng, skill };
        return { type: 'pick', value: rng.int(1, 3) };
      },
      llm: {
        ask: (state) => {
          seen.ask = state;
          return ask;
        },
        answer: (state, _id, reply) => {
          seen.answer = state;
          return reply === 'none' ? null : { type: 'pick', value: 1 };
        },
      },
    },
    recap: (state, ctx) => {
      seen.recap = { state, ctx };
      return { markdown: `Classic ${state.marker}` };
    },
    stagePick: {
      options: (settings) => {
        seen.stage = settings;
        return options;
      },
    },
    speech: () => readings,
    speechCatalog: () => readings,
  };
  return { game, seen, options, readings, ask };
}
