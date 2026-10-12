// Lightning Round — speed trivia. `game` is what the registry imports. One file per phase under
// ./phases; this file wires init / reduce / views / results / bot together and owns the phase
// order (`advance`), which is also what a VIP skip does.
import {
  composeReduce,
  gameManifestSchema,
  multiselectPicks,
  numberSetting,
  onPlayerEvent,
  recheckOnResume,
  seedRng,
  selectSetting,
  pausedFor,
  shiftClocks,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import type { ClassicPackId } from '../content/classic-schema';
import { recap } from './recap';
import { sampleInput } from './bot';
import { subcategoriesOf } from './content';
import { drawClassicQuestions, drawQuestions } from './draw';
import { enterIntro, reduceIntro } from './phases/intro';
import { enterTalk, reduceTalk } from './phases/talk';
import { enterQuestion, finishQuestionIfDone, reduceQuestion } from './phases/question';
import { enterReveal, reduceReveal } from './phases/reveal';
import { enterDone } from './phases/done';
import { enterWager, finishWagerIfDone, reduceWager } from './phases/wager';
import { enterPodium, reducePodium } from './phases/podium';
import { occupiedPodiumRanks } from './standings';
import { EMPTY_STATS, results } from './scoring';
import {
  PHASES,
  inputSchema,
  allParticipantsDone,
  isFinalIndex,
  isLastIndex,
  isPlayer,
  quizModeOf,
  groupModeOf,
} from './types';
import { makeTeams } from './teams';
import type { Input, Settings, State } from './types';
import { controllerView, tvView } from './views';

// Parsed once: a typo in manifest.json fails at import time instead of deep inside the engine.
const manifest = gameManifestSchema.parse(manifestJson);

export type { LightningControllerView, LightningTvView } from './views';
export type {
  LightningControllerView as KahootControllerView,
  LightningTvView as KahootTvView,
} from './views';

/** Settings as the manifest declares them; out-of-range values (tests, old rooms) are clamped. */
export function settingsFrom(raw: InitContext['settings']): Settings {
  const category = selectSetting(manifest, raw, 'category');
  // Topics: the manifest's comma-joined multiselect, kept to the category's own topics (ADR-034).
  const topics = subcategoriesOf(category);
  return {
    quizMode: selectSetting(manifest, raw, 'quizMode') as Settings['quizMode'],
    classicPack: selectSetting(manifest, raw, 'classicPack') as ClassicPackId,
    ...(raw['quizMode'] === 'teams' || raw['quizMode'] === 'tv-vote'
      ? {
          teamCount: numberSetting(manifest, raw, 'teamCount'),
          talkSeconds: numberSetting(manifest, raw, 'talkSeconds'),
        }
      : {}),
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
  const [draw, rng] =
    settings.quizMode !== 'wager'
      ? drawClassicQuestions(
          seedRng(ctx.seed),
          settings.classicPack ?? 'general',
          settings.questions,
        )
      : drawQuestions(
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
    left: [],
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
  const mode = groupModeOf(base);
  if (mode) {
    const [teams, after] = makeTeams(mode, Object.keys(players), settings.teamCount ?? 2, rng);
    return enterIntro(
      {
        ...base,
        rng: after,
        teams,
        teamScores: Object.fromEntries(teams.map((team) => [team.id, 0])),
        teamGains: {},
        roomStreak: 0,
      },
      ctx.now,
    );
  }
  return enterIntro(base, ctx.now);
}

/** What the deadline of the current phase does — also the VIP "skip" (README "Edge cases"). */
export function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'intro':
      return groupModeOf(state) ? enterTalk(state, now) : enterQuestion(state, now);
    case 'talk':
    case 'wager':
      return enterQuestion(state, now);
    case 'question':
      return enterReveal(state, now);
    case 'reveal': {
      if (quizModeOf(state) === 'classic')
        return isLastIndex(state, state.index)
          ? enterPodium(state, now)
          : groupModeOf(state)
            ? enterTalk(state, now)
            : enterQuestion(state, now);
      if (isFinalIndex(state, state.index)) return enterDone(state, now);
      const lastRegular = state.index === state.questionIds.length - 2;
      return lastRegular ? enterWager(state, now) : enterQuestion(state, now);
    }
    case 'podium': {
      const nextRank = occupiedPodiumRanks(state).find((rank) => rank < (state.podiumRank ?? 1));
      return nextRank ? enterPodium(state, now, nextRank) : enterDone(state, now);
    }
    default:
      return state;
  }
}

/** The drop of the last outstanding player ends the phase like their input would have
 *  (review-loop #48): the room never sits out a full timer for someone who has gone. */
function closeIfDone(state: State, now: number): State {
  if (state.phase.id === 'question') return finishQuestionIfDone(state, now, advance);
  if (state.phase.id === 'wager') return finishWagerIfDone(state, now, advance);
  return state;
}
/** A reconnecting participant can still use the original window during an early reading hold. */
function restorePendingWindow(state: State): State {
  const question = state.phase.id === 'question';
  if (!question && state.phase.id !== 'wager') return state;
  const done = question ? Object.keys(state.picks) : Object.keys(state.wagers);
  const end = question ? state.answerClosesAt : state.wagerClosesAt;
  if (end === undefined || allParticipantsDone(state, done) || state.phase.deadline === end)
    return state;
  return { ...state, phase: { ...state.phase, deadline: end } };
}

// The SDK's skeleton: player → VIP → paused → the phase on stage.
const reduce = composeReduce<State, Input>({
  phases: {
    intro: reduceIntro,
    talk: reduceTalk,
    question: reduceQuestion,
    reveal: reduceReveal,
    wager: reduceWager,
    podium: reducePodium,
  },
  advance,
  end: enterDone,
  onPlayer: (state, event) => {
    if (!isPlayer(state, event.playerId)) return state;
    const next = onPlayerEvent({ ...state, left: state.left ?? [] }, event, { closeIfDone });
    return event.connected ? restorePendingWindow(next) : next;
  },
  afterVip: (before, vip, event) => {
    const resumed = event.type === 'vip' && event.action === 'resume' && before.phase.paused;
    const shifted = resumed
      ? shiftClocks(
          vip,
          ['answerClosesAt', 'questionReadableUntil', 'wagerClosesAt', 'wagerReadableUntil'],
          pausedFor(before, event.now),
        )
      : vip;
    return recheckOnResume(shifted, event, closeIfDone);
  },
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
