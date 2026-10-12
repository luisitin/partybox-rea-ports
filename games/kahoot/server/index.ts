// Kahoot! plugs into the real PartyBox contract. The SDK owns event order and pause behavior.
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
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { currentQuestion, makeDeck, publicQuestion } from './content';
import { enterDone } from './phases/done';
import { enterPodium, reducePodium, stepPodium } from './phases/podium';
import { eligibleIds, enterQuestion, everyoneAnswered, reduceQuestion } from './phases/question';
import { enterReveal, reduceReveal } from './phases/reveal';
import { enterScore, reduceScore } from './phases/score';
import { enterTalk, reduceTalk } from './phases/talk';
import { results, standings } from './scoring';
import { makeTeams, modeOf, teamOf, teamRank } from './teams';
import { inputSchema, PHASES } from './types';
import type { Input, QuizMode, State } from './types';
import type { PublicTeam, QuizControllerView, QuizTvView, RevealData, Standing } from './views';

const manifest = gameManifestSchema.parse(manifestJson);

function init(ctx: InitContext): State {
  const settings = {
    mode: selectSetting(manifest, ctx.settings, 'mode') as QuizMode,
    pack: selectSetting(manifest, ctx.settings, 'pack'),
    rounds: numberSetting(manifest, ctx.settings, 'rounds'),
    seconds: numberSetting(manifest, ctx.settings, 'seconds'),
    teamCount: Math.min(ctx.players.length, numberSetting(manifest, ctx.settings, 'teamCount')),
    talkSeconds: numberSetting(manifest, ctx.settings, 'talkSeconds'),
  };
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const scores = Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
  const [deck, afterDeck] = makeDeck(settings.pack, settings.rounds, seedRng(ctx.seed));
  const [teams, rng] = makeTeams(
    settings.mode,
    ctx.players.map((p) => p.id),
    settings.teamCount,
    afterDeck,
  );
  const base: State = {
    phase: { id: 'question', startedAt: ctx.now, deadline: null },
    rng,
    players,
    settings,
    deck,
    round: 1,
    answers: {},
    verdicts: {},
    scores,
    streaks: { ...scores },
    previousScores: { ...scores },
    teams,
    teamScores: Object.fromEntries(teams.map((team) => [team.id, 0])),
    teamGains: {},
    decision: null,
    roomStreak: 0,
    left: [],
    openedAt: ctx.now,
    answerMs: 0,
    podiumStep: 0,
    phoneOnly: ctx.presence?.phoneOnly === true,
  };
  return closeIfDone(enterRound(base, ctx.now, 1), ctx.now);
}

function enterRound(state: State, now: number, round: number): State {
  return modeOf(state) === 'solo' ? enterQuestion(state, now, round) : enterTalk(state, now, round);
}

function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'talk':
      return closeIfDone(enterQuestion(state, now, state.round), now);
    case 'question':
      return enterReveal(state, now);
    case 'reveal':
      return state.round >= state.deck.length ? enterPodium(state, now) : enterScore(state, now);
    case 'score':
      return closeIfDone(enterRound(state, now, state.round + 1), now);
    case 'podium':
      return stepPodium(state, now, enterDone);
    default:
      return state;
  }
}

function closeIfDone(state: State, now: number): State {
  if (state.phase.paused) return state;
  if (state.phase.id === 'talk' && eligibleIds(state).length === 0)
    return closeIfDone(enterQuestion(state, now, state.round), now);
  return state.phase.id === 'question' && !state.phase.paused && everyoneAnswered(state)
    ? enterReveal(state, now)
    : state;
}

const coreReduce = composeReduce<State, Input>({
  phases: {
    talk: reduceTalk,
    question: reduceQuestion,
    reveal: reduceReveal,
    score: reduceScore,
    podium: reducePodium,
  },
  advance,
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone }),
  prepare: (state, event) =>
    event.type === 'vip' && event.action === 'resume' && state.phase.id === 'question'
      ? { ...state, openedAt: state.openedAt + pausedFor(state, event.now) }
      : state,
  afterVip: (_before, after, event) => recheckOnResume(after, event, closeIfDone),
});

function reduce(state: State, event: Parameters<typeof coreReduce>[1]): State {
  return state.phase.id === 'done' ? state : coreReduce(state, event);
}

const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.phase.id !== 'question' || state.left.includes(id)
      ? 'waiting'
      : Object.hasOwn(state.answers, id)
        ? 'submitted'
        : 'active';

function publicStandings(state: State): Standing[] {
  const rows = standings(state);
  return state.phase.id === 'podium'
    ? rows.filter((r) => r.rank <= 3 && r.rank >= 3 - state.podiumStep)
    : state.phase.id === 'score' || state.phase.id === 'done'
      ? rows
      : [];
}

function revealData(state: State): RevealData | null {
  if (state.phase.id !== 'reveal') return null;
  const q = currentQuestion(state);
  const counts = [0, 0, 0, 0];
  for (const answer of Object.values(state.answers))
    counts[answer.choice] = (counts[answer.choice] ?? 0) + 1;
  return {
    correctChoice: q.correct,
    explanation: q.explanation,
    counts,
    missed: Object.keys(state.players).length - Object.keys(state.answers).length,
  };
}

function publicTeams(state: State, playerId?: string): PublicTeam[] {
  const finalReveal = state.phase.id === 'reveal' && state.round === state.deck.length;
  const receipt = ['reveal', 'score', 'podium', 'done'].includes(state.phase.id);
  return (state.teams ?? []).map((team) => {
    const rank = teamRank(state, team.id);
    const withheld = finalReveal || (state.phase.id === 'podium' && rank < 3 - state.podiumStep);
    const own = playerId !== undefined && team.members.includes(playerId);
    return {
      id: team.id,
      name: team.name,
      members: [...team.members],
      score:
        withheld && !own
          ? (state.previousScores[team.members[0] ?? ''] ?? 0)
          : (state.teamScores[team.id] ?? 0),
      gained: receipt && (!withheld || own) ? (state.teamGains[team.id] ?? 0) : 0,
      rank: withheld ? 0 : rank,
    };
  });
}

function tvView(state: State): QuizTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    round: state.round,
    rounds: state.deck.length,
    mode: modeOf(state),
    team: null,
    teams: publicTeams(state),
    decision: state.phase.id === 'reveal' ? state.decision : null,
    question: ['talk', 'question', 'reveal'].includes(state.phase.id)
      ? publicQuestion(state)
      : null,
    reveal: revealData(state),
    standings: publicStandings(state),
    answered: eligibleIds(state).filter((id) => Object.hasOwn(state.answers, id)).length,
    eligible: eligibleIds(state).length,
    podiumStep: state.podiumStep,
  };
}

function controllerView(state: State, playerId: string): QuizControllerView {
  const player = hasPlayer(state, playerId);
  const stage = !player || state.phoneOnly || state.players[playerId]!.canSeeTv === false;
  const questionOnStage = state.phase.id === 'question' || state.phase.id === 'reveal';
  const answer = Object.hasOwn(state.answers, playerId) ? state.answers[playerId] : undefined;
  const verdict =
    state.phase.id !== 'question' &&
    state.phase.id !== 'talk' &&
    Object.hasOwn(state.verdicts, playerId)
      ? state.verdicts[playerId]!
      : null;
  const score = player ? state.scores[playerId]! : 0;
  const ownTeam = player ? teamOf(state, playerId) : null;
  const rank = player
    ? modeOf(state) !== 'solo' && ownTeam
      ? teamRank(state, ownTeam.id)
      : 1 + Object.values(state.scores).filter((s) => s > score).length
    : 0;
  const finalReveal = state.phase.id === 'reveal' && state.round === state.deck.length;
  const withheld = finalReveal || (state.phase.id === 'podium' && rank < 3 - state.podiumStep);
  const teams = publicTeams(state, player ? playerId : undefined);
  return {
    ...controllerEnvelope(state, manifest.id, playerId, { statusOf: statusOf(state) }),
    round: state.round,
    rounds: state.deck.length,
    mode: modeOf(state),
    team: ownTeam ? teams.find((team) => team.id === ownTeam.id)! : null,
    teams,
    decision: state.phase.id === 'reveal' ? state.decision : null,
    question:
      state.phase.id === 'talk' || (stage && questionOnStage) ? publicQuestion(state) : null,
    reveal: stage ? revealData(state) : null,
    standings: stage ? publicStandings(state) : [],
    submitted: answer !== undefined,
    selected: answer?.choice ?? null,
    verdict,
    score:
      state.phase.id === 'question' || state.phase.id === 'talk'
        ? player
          ? state.previousScores[playerId]!
          : 0
        : score,
    rank: withheld ? 0 : rank,
    streak: player ? state.streaks[playerId]! : 0,
    stage,
    podiumStep: state.podiumStep,
  };
}

export const game: GameDefinition<State, Input, QuizTvView, QuizControllerView> = {
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
