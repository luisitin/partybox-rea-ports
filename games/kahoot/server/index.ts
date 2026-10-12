// Lightning Round — speed trivia. `game` is what the registry imports. One file per phase under
// ./phases; this file wires init / reduce / views / results / bot together and owns the phase
// order (`advance`), which is also what a VIP skip does.
import {
  allConnectedDone,
  composeReduce,
  gameManifestSchema,
  multiselectPicks,
  numberSetting,
  onPlayerEvent,
  recheckOnResume,
  seedRng,
  selectSetting,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { recap } from './recap';
import { sampleInput } from './bot';
import { subcategoriesOf } from './content';
import { drawQuestions } from './draw';
import { enterIntro, reduceIntro } from './phases/intro';
import { enterQuestion, reduceQuestion } from './phases/question';
import { enterDone, enterReveal, reduceReveal } from './phases/reveal';
import { enterWager, reduceWager } from './phases/wager';
import { EMPTY_STATS, results } from './scoring';
import { PHASES, inputSchema, isFinalIndex } from './types';
import type { Input, Settings, State } from './types';
import { controllerView, tvView } from './views';

// Parsed once: a typo in manifest.json fails at import time instead of deep inside the engine.
const manifest = gameManifestSchema.parse(manifestJson);

export type { LightningControllerView, LightningTvView } from './views';

/** Settings as the manifest declares them; out-of-range values (tests, old rooms) are clamped. */
export function settingsFrom(raw: InitContext['settings']): Settings {
  const category = selectSetting(manifest, raw, 'category');
  // Topics: the manifest's comma-joined multiselect, kept to the category's own topics (ADR-034).
  const topics = subcategoriesOf(category);
  return {
    questions: numberSetting(manifest, raw, 'questions'),
    answerSeconds: numberSetting(manifest, raw, 'answerSeconds'),
    category,
    // Ticked order kept (the draw follows it); the category's own topics only.
    subcategories: multiselectPicks(raw['subcategories']).filter((t) => topics.includes(t)),
  };
}

function init(ctx: InitContext): State {
  const players: State['players'] = {};
  const zero: Record<string, number> = {};
  const stats: State['stats'] = {};
  for (const p of ctx.players) {
    players[p.id] = p;
    zero[p.id] = 0;
    stats[p.id] = EMPTY_STATS;
  }
  const settings = settingsFrom(ctx.settings);
  const [draw, rng] = drawQuestions(
    seedRng(ctx.seed),
    settings.category,
    settings.questions,
    settings.subcategories,
    ctx.contentLang === 'es' ? 'es' : undefined,
  );
  const base: State = {
    phase: { id: 'intro', startedAt: ctx.now, deadline: null },
    rng,
    players,
    settings,
    drawnFrom: draw.drawnFrom,
    drawnSubs: draw.drawnSubs,
    questionIds: draw.ids,
    index: -1,
    picks: {},
    scores: { ...zero },
    streaks: { ...zero },
    wagers: {},
    lastDelta: {},
    stats,
    ...(ctx.presence?.phoneOnly ? { phoneOnly: true as const } : {}),
    // ADR-054: the deck's language, fixed for the game (absent = English).
    ...(ctx.contentLang === 'es' ? { contentLang: 'es' as const } : {}),
  };
  return enterIntro(base, ctx.now);
}

/** What the deadline of the current phase does — also the VIP "skip" (README "Edge cases"). */
export function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'intro':
    case 'wager':
      return enterQuestion(state, now);
    case 'question':
      return enterReveal(state, now);
    case 'reveal': {
      if (isFinalIndex(state, state.index)) return enterDone(state, now);
      const lastRegular = state.index === state.questionIds.length - 2;
      return lastRegular ? enterWager(state, now) : enterQuestion(state, now);
    }
    default:
      return state;
  }
}

/** The drop of the last outstanding player ends the phase like their input would have
 *  (review-loop #48): the room never sits out a full timer for someone who has gone. */
function closeIfDone(state: State, now: number): State {
  const done =
    state.phase.id === 'question'
      ? Object.keys(state.picks)
      : state.phase.id === 'wager'
        ? Object.keys(state.wagers)
        : null;
  return done && allConnectedDone(state, done) ? advance(state, now) : state;
}

// The SDK's skeleton: player → VIP → paused → the phase on stage.
const reduce = composeReduce<State, Input>({
  phases: {
    intro: reduceIntro,
    question: reduceQuestion,
    reveal: reduceReveal,
    wager: reduceWager,
  },
  advance,
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone }),
  afterVip: (_before, vip, event) => recheckOnResume(vip, event, closeIfDone),
});

export const game: GameDefinition<State, Input> = {
  recap,
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView: (state) => tvView(state, manifest.id),
  controllerView: (state, playerId) => controllerView(state, manifest.id, playerId),
  results,
  bot: { sampleInput },
};
