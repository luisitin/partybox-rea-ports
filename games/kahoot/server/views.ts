// Public snapshots omit future answers, wagers and final podium totals by key.
import { compareCodeUnits, controllerEnvelope, envelope } from '@partybox/game-sdk';
import type { PlayerStatus } from '@partybox/game-sdk';
import { categoryLabel, drawLabel, questionById } from './content';
import { labelOf } from '../content/schema';
import { questionPoints, wagerOptions } from './scoring';
import {
  BASE_POINTS,
  SPEED_MAX_POINTS,
  answerWindowOf,
  connectedParticipants,
  isFinalIndex,
  isLastIndex,
  isParticipating,
  isPlayer,
  questionLangOf,
  quizModeOf,
  groupModeOf,
} from './types';
import type { State } from './types';
import { revealMs } from './phases/reveal';
import { classicRevealBeats, podiumMs, wagerRevealBeats } from './pacing';
import { occupiedPodiumRanks, revealedPodiumEntries, standingsOf } from './standings';
import { groupStandings, teamOf } from './teams';
import type {
  AnswerDistribution,
  LightningControllerView,
  LightningTvView,
  PodiumView,
  QuestionView,
  RevealNext,
  RevealRow,
  RoundView,
  Topic,
  GroupView,
} from './view-types';
export type {
  AnswerStamp,
  LightningControllerView,
  LightningTvView,
  Outcome,
  PodiumView,
  QuestionView,
  RevealNext,
  RevealRow,
  RoundView,
  StandingRow,
  Topic,
  GroupView,
} from './view-types';
export { standingsOf } from './standings';

function hidesFinalScores(state: State): boolean {
  return (
    quizModeOf(state) === 'classic' &&
    (state.phase.id === 'podium' ||
      (state.phase.id === 'reveal' && isLastIndex(state, state.index)))
  );
}
function groupOf(state: State, playerId?: string): GroupView | undefined {
  const mode = groupModeOf(state);
  if (!mode) return undefined;
  let teams = groupStandings(state);
  if (mode === 'teams' && state.phase.id === 'reveal')
    teams = teams.map((team) => {
      const accuracy = state.teamAccuracy?.[team.id];
      return {
        ...team,
        correctPercent:
          accuracy && accuracy.total > 0
            ? Math.round((100 * accuracy.correct) / accuracy.total)
            : 0,
      };
    });
  if (state.phase.id === 'reveal' && isLastIndex(state, state.index)) teams = [];
  if (state.phase.id === 'podium')
    teams = teams.filter((team) => team.rank >= (state.podiumRank ?? 1) && team.rank <= 3);
  const leftMembers =
    mode === 'teams'
      ? teams.flatMap((team) => team.members.filter((id) => state.left?.includes(id)))
      : [];
  const own = playerId === undefined ? undefined : teamOf(state, playerId);
  return {
    mode,
    teams,
    ...(own ? { myTeamId: own.id } : {}),
    ...(leftMembers.length > 0 ? { leftMembers } : {}),
    ...(mode === 'tv-vote' ? { roomStreak: state.roomStreak ?? 0 } : {}),
    ...(['reveal', 'podium', 'done'].includes(state.phase.id) && state.roomDecision !== undefined
      ? { decision: state.roomDecision }
      : {}),
  };
}

/** An unrevealed team receipt must not reveal the final score through a personal field. */
function ownScore(state: State, id: string): number {
  const score = state.scores[id] ?? 0;
  if (!groupModeOf(state) || !hidesFinalScores(state)) return score;
  const own = teamOf(state, id);
  if (!own) return 0;
  if (state.phase.id === 'podium' && groupOf(state)?.teams.some((team) => team.id === own.id))
    return score;
  return score - (state.teamGains?.[own.id] ?? 0);
}
function nextOf(state: State): { next: RevealNext; vipSkipHidden: true } | Record<string, never> {
  if (state.phase.id !== 'reveal' || state.index < 0 || isFinalIndex(state, state.index)) return {};
  if (quizModeOf(state) === 'classic')
    return { next: isLastIndex(state, state.index) ? 'podium' : 'question', vipSkipHidden: true };
  return {
    next: state.index === state.questionIds.length - 2 ? 'wager' : 'question',
    vipSkipHidden: true,
  };
}
export function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) => {
    if (!isParticipating(state, id)) return 'waiting';
    if (state.phase.id === 'question')
      return Object.hasOwn(state.picks, id) ? 'submitted' : 'active';
    if (state.phase.id === 'wager') return Object.hasOwn(state.wagers, id) ? 'submitted' : 'active';
    return 'waiting';
  };
}
export function roundOf(state: State): RoundView | null {
  if (state.index < 0 || state.questionIds.length === 0) return null;
  const classic = quizModeOf(state) === 'classic';
  return {
    number: state.index + 1,
    total: Math.max(0, state.questionIds.length - (classic ? 0 : 1)),
    final: isFinalIndex(state, state.index),
    ...(classic ? { last: isLastIndex(state, state.index) } : {}),
  };
}
export function questionOf(state: State): QuestionView | null {
  if (state.index < 0) return null;
  const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
  return q
    ? {
        id: q.id,
        categoryLabel: categoryLabel(q.category),
        subcategoryLabel: labelOf(q.subcategory),
        difficulty: q.difficulty,
        text: q.question,
        choices: [...q.choices],
      }
    : null;
}
function revealRows(state: State, correctIndex: number, final: boolean): RevealRow[] {
  return Object.values(state.players)
    .map((p) => {
      const pick = state.picks[p.id];
      const correct = pick?.index === correctIndex;
      return {
        playerId: p.id,
        name: p.name,
        avatarId: p.avatarId,
        connected: p.connected,
        pickIndex: pick?.index ?? null,
        correct,
        delta: state.lastDelta[p.id] ?? 0,
        streak: state.streaks[p.id] ?? 0,
        score: state.scores[p.id] ?? 0,
        ...(final ? { wagerAmount: state.wagers[p.id] ?? 0 } : {}),
        ...(correct && pick ? { elapsedMs: pick.elapsedMs } : {}),
      };
    })
    .sort(
      (a, b) =>
        Number(b.correct) - Number(a.correct) ||
        (a.correct && b.correct ? (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0) : 0) ||
        b.score - a.score ||
        compareCodeUnits(a.playerId, b.playerId),
    );
}
function distributionOf(state: State): AnswerDistribution {
  const counts = [0, 0, 0, 0];
  let missed = 0;
  for (const id of Object.keys(state.players)) {
    const pick = state.picks[id];
    if (!pick) missed++;
    else counts[pick.index] = (counts[pick.index] ?? 0) + 1;
  }
  return { counts, missed };
}
function revealAtOf(state: State): number {
  return state.phase.deadline === null
    ? state.phase.startedAt
    : state.phase.deadline - revealMs(state);
}
function podiumOf(state: State): PodiumView {
  const rank = state.podiumRank ?? 1;
  return {
    rank,
    revealedRanks: occupiedPodiumRanks(state).filter((r) => r >= rank),
    entries: revealedPodiumEntries(state),
    beatAt:
      state.phase.deadline === null
        ? state.phase.startedAt
        : state.phase.deadline - podiumMs(state),
  };
}
export function tvView(state: State, gameId: string): LightningTvView {
  const phase = state.phase.id;
  const classic = quizModeOf(state) === 'classic';
  const hidden = hidesFinalScores(state);
  const group = groupOf(state);
  const view: LightningTvView = {
    ...envelope(state, gameId, {
      statusOf: statusOf(state),
      ...(hidden ? {} : { scores: state.scores }),
    }),
    contentLang: state.contentLang ?? 'en',
    questionLang: questionLangOf(state),
    quizMode: quizModeOf(state),
    categoryLabel: drawLabel(state.drawnFrom, state.drawnSubs ?? []),
    round: roundOf(state),
    question:
      phase === 'talk' || phase === 'question' || phase === 'reveal' ? questionOf(state) : null,
    answeredCount:
      phase === 'question'
        ? connectedParticipants(state).filter((id) => Object.hasOwn(state.picks, id)).length
        : phase === 'wager'
          ? connectedParticipants(state).filter((id) => Object.hasOwn(state.wagers, id)).length
          : 0,
    totalCount: connectedParticipants(state).length,
    // Group stages place the original-style circular clock beside the question.
    // Phones retain their normal envelope and their own local countdown.
    timerMode:
      group && (phase === 'talk' || phase === 'question')
        ? 'hidden'
        : ['intro', 'reveal', 'podium'].includes(phase)
          ? 'quiet'
          : 'normal',
    ...nextOf(state),
    ...(group ? { group } : {}),
  };
  if (phase === 'question' && classic)
    view.answerStamp = {
      questionId: state.questionIds[state.index]!,
      questionStartedAt: state.phase.startedAt,
    };
  if (phase === 'reveal') {
    view.revealAt = revealAtOf(state);
    const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
    if (q) {
      view.correctIndex = q.answerIndex;
      if (!hidden && !group)
        view.rows = revealRows(state, q.answerIndex, isFinalIndex(state, state.index));
      if (!isFinalIndex(state, state.index)) view.answerDistribution = distributionOf(state);
      if (classic && 'explanation' in q) view.explanation = q.explanation;
    }
    if (!hidden) view.standings = standingsOf(state);
    if (!isFinalIndex(state, state.index) && !(classic && isLastIndex(state, state.index)))
      view.leaderboardAt =
        view.revealAt +
        (classic ? classicRevealBeats(state).chartMs : wagerRevealBeats(state).raceMs);
    if (view.next)
      view.nextAt = view.leaderboardAt ?? view.revealAt + classicRevealBeats(state).chartMs;
  }
  if (phase === 'wager' || phase === 'done') view.standings = standingsOf(state);
  if (phase === 'wager') view.finalTopic = finalTopicOf(state);
  if (phase === 'podium' && classic) view.podium = podiumOf(state);
  if (view.round && !view.round.final && view.round.total > 0)
    view.progressStep = { unit: 'question', n: view.round.number, of: view.round.total };
  return view;
}
export function controllerView(
  state: State,
  gameId: string,
  playerId: string,
): LightningControllerView {
  const phase = state.phase.id;
  const classic = quizModeOf(state) === 'classic';
  const hidden = hidesFinalScores(state);
  const group = groupOf(state, playerId);
  const me = isPlayer(state, playerId);
  const participating = isParticipating(state, playerId);
  const phoneOnly = state.phoneOnly === true || (me && state.players[playerId]?.canSeeTv === false);
  const showStage = phoneOnly || !participating;
  const score = me ? ownScore(state, playerId) : 0;
  const myPick = me && Object.hasOwn(state.picks, playerId) ? state.picks[playerId] : undefined;
  const view: LightningControllerView = {
    ...controllerEnvelope(state, gameId, playerId, {
      statusOf: statusOf(state),
      ...(hidden ? {} : { scores: state.scores }),
    }),
    phoneOnly,
    participating,
    showStage,
    stage: showStage ? tvView(state, gameId) : null,
    contentLang: state.contentLang ?? 'en',
    questionLang: questionLangOf(state),
    quizMode: quizModeOf(state),
    timerMode: ['intro', 'reveal', 'podium'].includes(phase) ? 'quiet' : 'normal',
    round: roundOf(state),
    question:
      phase === 'reveal' || phase === 'talk' || (phase === 'question' && (!classic || showStage))
        ? questionOf(state)
        : null,
    myPickIndex: myPick?.index ?? null,
    myScore: score,
    myStreak: me ? (state.streaks[playerId] ?? 0) : 0,
    ...nextOf(state),
    ...(group ? { group } : {}),
  };
  if (phase === 'question' && classic)
    view.answerStamp = {
      questionId: state.questionIds[state.index]!,
      questionStartedAt: state.phase.startedAt,
    };
  const final = isFinalIndex(state, state.index);
  if (phase === 'question' && participating && !final)
    view.worth = {
      base: BASE_POINTS,
      speedMax: SPEED_MAX_POINTS,
      bonus:
        questionPoints(
          answerWindowOf(state),
          answerWindowOf(state) / 1000,
          (state.streaks[playerId] ?? 0) + 1,
        ) - BASE_POINTS,
      windowMs: answerWindowOf(state),
    };
  if (phase === 'reveal') {
    view.revealAt = revealAtOf(state);
    const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
    if (q) {
      view.correctIndex = q.answerIndex;
      const room = group?.mode === 'tv-vote';
      const correct = room ? state.roomDecision === q.answerIndex : myPick?.index === q.answerIndex;
      view.outcome = { correct, delta: me ? (state.lastDelta[playerId] ?? 0) : 0 };
      if (classic) {
        const base =
          correct && (myPick || room)
            ? questionPoints(
                room ? (state.roomElapsedMs ?? 0) : myPick!.elapsedMs,
                answerWindowOf(state) / 1000,
                1,
              )
            : 0;
        view.outcome = {
          ...view.outcome,
          answered: room ? state.roomDecision !== undefined : myPick !== undefined,
          base,
          bonus: correct ? view.outcome.delta - base : 0,
        };
        view.answerDistribution = distributionOf(state);
        if ('explanation' in q) view.explanation = q.explanation;
      }
      if (!hidden && !group) view.rows = revealRows(state, q.answerIndex, final);
    }
    if (classic && !hidden) {
      view.standings = standingsOf(state);
      const own = view.standings.find((r) => r.playerId === (group?.myTeamId ?? playerId));
      if (own) view.myRank = own.rank;
      view.leaderboardAt = view.revealAt + classicRevealBeats(state).chartMs;
    }
    if (!classic && !final) view.leaderboardAt = view.revealAt + wagerRevealBeats(state).raceMs;
    if (view.next)
      view.nextAt = view.leaderboardAt ?? view.revealAt + classicRevealBeats(state).chartMs;
  }
  const round = view.round;
  if (round && !round.final && round.total > 0)
    view.progressStep = { unit: 'question', n: round.number, of: round.total };
  if (phase === 'wager' && participating) view.wagerChoices = wagerOptions(score);
  if (phase === 'wager') view.finalTopic = finalTopicOf(state);
  const wagerVisible = phase === 'wager' || ((phase === 'question' || phase === 'reveal') && final);
  if (wagerVisible && me && Object.hasOwn(state.wagers, playerId))
    view.myWagerAmount = state.wagers[playerId];
  if (phase === 'podium' && classic) {
    view.podium = podiumOf(state);
    const own = view.podium.entries.find((r) => r.playerId === (group?.myTeamId ?? playerId));
    if (own) view.myRank = own.rank;
  }
  if (phase === 'done') {
    if (group) view.standings = standingsOf(state);
    const own = standingsOf(state).find((r) => r.playerId === (group?.myTeamId ?? playerId));
    if (own) view.myRank = own.rank;
  }
  return view;
}
function finalTopicOf(state: State): Topic | null {
  const q = questionById(state.questionIds[state.questionIds.length - 1] ?? '', state.contentLang);
  return q
    ? {
        categoryLabel: categoryLabel(q.category),
        subcategoryLabel: labelOf(q.subcategory),
        difficulty: q.difficulty,
      }
    : null;
}
