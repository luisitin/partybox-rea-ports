// TV and controller views (docs/GAME_CONTRACT.md "Views"). Hidden information is omitted by KEY,
// never nulled: `correctIndex`, `pickIndex` and `wagerAmount` only exist once the stage may show
// them (__tests__/contract.config.ts asserts those key names never leak early).
import { BASE_POINTS, SPEED_MAX_POINTS } from './types';
import { compareCodeUnits, controllerEnvelope, envelope, rank } from '@partybox/game-sdk';
import type { ControllerView, PlayerStatus, TvView } from '@partybox/game-sdk';
import { categoryLabel, drawLabel, questionById } from './content';
import { labelOf } from '../content/schema';
import { questionPoints, wagerOptions } from './scoring';
import type { WagerOption } from './scoring';
import { isFinalIndex } from './types';
import type { State } from './types';
import { revealMs } from './phases/reveal';
export interface RoundView {
  /** 1-based number of the current question; the final question is `total + 1`. */
  number: number;
  /** Regular questions in this game. */
  total: number;
  final: boolean;
}
export interface QuestionView {
  id: string;
  categoryLabel: string;
  /** The question's topic inside its category ("Basketball"). */
  subcategoryLabel: string;
  difficulty: string;
  text: string;
  choices: string[];
}
export interface RevealRow {
  playerId: string;
  name: string;
  avatarId: string;
  connected: boolean;
  pickIndex: number | null;
  correct: boolean;
  /** Score change at this reveal (negative on a lost wager). */
  delta: number;
  streak: number;
  score: number;
  /** Final reveal only. */
  wagerAmount?: number;
  /** I-589 A: how long a right answer took (ms); absent for a wrong or missing one. */
  elapsedMs?: number;
}
export interface StandingRow {
  playerId: string;
  name: string;
  avatarId: string;
  connected: boolean;
  score: number;
  rank: number;
}
export interface LightningTvView extends TvView {
  /** Public language metadata normally stamped by the core host. */
  contentLang?: 'en' | 'es';
  categoryLabel: string;
  round: RoundView | null;
  /** From `question` on; the correct choice is only marked via `correctIndex` in `reveal`. */
  question: QuestionView | null;
  /** Picks (in `question`) or wagers (in `wager`) received from connected players. */
  answeredCount: number;
  totalCount: number;
  correctIndex?: number;
  /** Reveal timeline start, aligned with the deadline after a resume. */
  revealAt?: number;
  /** `reveal`: one row per player — right answers fastest first (I-589 A), then by score. */
  rows?: RevealRow[];
  /** Regular reveal only: counts for A–D and seats without an accepted answer. */
  answerDistribution?: { counts: number[]; missed: number };
  /** I-550 A: `wager`: the final question's topic. */
  finalTopic?: Topic | null;
  /** `reveal`, `wager` and `done`: ranked standings. */
  standings?: StandingRow[];
  /** I-589 (the owner's note): a regular reveal's Next button — what it moves on to. */
  next?: RevealNext;
}
export interface LightningControllerView extends ControllerView {
  /** Public language metadata normally stamped by the core host. */
  contentLang?: 'en' | 'es';
  round: RoundView | null;
  question: QuestionView | null;
  myPickIndex: number | null;
  myScore: number;
  myStreak: number;
  correctIndex?: number;
  /** `reveal`: how this player did. */
  outcome?: { correct: boolean; delta: number };
  /** `reveal`: the room's rows as the TV shows them — a "phone only" room reads them on the phone
   *  (the owner, 2026-09-21: Lightning was not optimised for phone only). */
  rows?: RevealRow[];
  /** I-589: a regular reveal's Next button (the VIP's phone shows it) — what it moves on to. */
  next?: RevealNext;
  /** `reveal`: the reveal's start on the room's clock, as the TV's: the phone's beats (✓/✗, the
   *  final's hold, Next) count from it, so a reloaded phone lands on the current beat. */
  revealAt?: number;
  /** I-288 B: `question`: what a right answer is worth, as a function of time — the phone ticks it. */
  worth?: { base: number; speedMax: number; bonus: number; windowMs: number };
  /** I-550 A: `wager`: the final question's topic. */
  finalTopic?: Topic | null;
  /** `wager`: the buttons for this player (0-score players only see 0). */
  wagerChoices?: WagerOption[];
  /** Own wager once placed (from `wager` through the final reveal). */
  myWagerAmount?: number;
  myRank?: number;
}

/** I-589: where a regular reveal's Next goes — the next question, or the wager before the final. */
export type RevealNext = 'question' | 'wager';

/** I-589 (the owner's note): a regular reveal carries its own Next button on the TV and the VIP's
 *  phone, so the shell's generic Skip / Next is hidden there. The final reveal keeps the shell's. */
function nextOf(state: State): { next: RevealNext; vipSkipHidden: true } | Record<string, never> {
  if (state.phase.id !== 'reveal' || state.index < 0 || isFinalIndex(state, state.index)) return {};
  const lastRegular = state.index === state.questionIds.length - 2;
  return { next: lastRegular ? 'wager' : 'question', vipSkipHidden: true };
}
export function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) => {
    if (state.phase.id === 'question')
      return Object.hasOwn(state.picks, id) ? 'submitted' : 'active';
    if (state.phase.id === 'wager') return Object.hasOwn(state.wagers, id) ? 'submitted' : 'active';
    return 'waiting';
  };
}
export function roundOf(state: State): RoundView | null {
  if (state.index < 0 || state.questionIds.length === 0) return null;
  return {
    number: state.index + 1,
    total: Math.max(0, state.questionIds.length - 1),
    final: isFinalIndex(state, state.index),
  };
}
export function questionOf(state: State): QuestionView | null {
  if (state.index < 0) return null;
  const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
  if (!q) return null;
  return {
    id: q.id,
    categoryLabel: categoryLabel(q.category),
    subcategoryLabel: labelOf(q.subcategory),
    difficulty: q.difficulty,
    text: q.question,
    choices: [...q.choices],
  };
}

function connectedCount(state: State): number {
  return Object.values(state.players).filter((p) => p.connected).length;
}
export function standingsOf(state: State): StandingRow[] {
  return rank(state.scores).flatMap((r) => {
    const p = state.players[r.playerId];
    return p
      ? [
          {
            playerId: p.id,
            name: p.name,
            avatarId: p.avatarId,
            connected: p.connected,
            score: r.score,
            rank: r.rank,
          },
        ]
      : [];
  });
}

function revealRows(state: State, correctIndex: number, final: boolean): RevealRow[] {
  const rows = Object.values(state.players).map((p) => {
    const row: RevealRow = {
      playerId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      connected: p.connected,
      pickIndex: state.picks[p.id]?.index ?? null,
      correct: state.picks[p.id]?.index === correctIndex,
      delta: state.lastDelta[p.id] ?? 0,
      streak: state.streaks[p.id] ?? 0,
      score: state.scores[p.id] ?? 0,
    };
    if (final) row.wagerAmount = state.wagers[p.id] ?? 0;
    const pick = state.picks[p.id];
    if (row.correct && pick) row.elapsedMs = pick.elapsedMs; // I-589 A
    return row;
  });
  // I-589 A: the race — right answers fastest first, then the rest by score
  return rows.sort(
    (a, b) =>
      Number(b.correct) - Number(a.correct) ||
      (a.correct && b.correct ? (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0) : 0) ||
      b.score - a.score ||
      compareCodeUnits(a.playerId, b.playerId),
  );
}
/** Reveal timeline start, aligned with the deadline after a resume (the pause is not counted). */
function revealAtOf(state: State): number {
  return state.phase.deadline === null
    ? state.phase.startedAt
    : state.phase.deadline - revealMs(state);
}
export function tvView(state: State, gameId: string): LightningTvView {
  const phase = state.phase.id;
  const view: LightningTvView = {
    ...envelope(state, gameId, { statusOf: statusOf(state), scores: state.scores }),
    contentLang: state.contentLang ?? 'en',
    categoryLabel: drawLabel(state.drawnFrom, state.drawnSubs ?? []),
    round: roundOf(state),
    question: phase === 'question' || phase === 'reveal' ? questionOf(state) : null,
    answeredCount:
      phase === 'question'
        ? Object.keys(state.picks).filter((id) => state.players[id]?.connected).length
        : phase === 'wager'
          ? Object.keys(state.wagers).filter((id) => state.players[id]?.connected).length
          : 0,
    totalCount: connectedCount(state),
    // Passive phases (nobody can act): a quiet bar instead of red digits and countdown ticks
    // (ADR-030) — the reveal has its own beats and the intro is a title card.
    timerMode: phase === 'intro' || phase === 'reveal' ? 'quiet' : 'normal',
    ...nextOf(state),
  };
  if (phase === 'reveal') {
    view.revealAt = revealAtOf(state);
    const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
    if (q) {
      view.correctIndex = q.answerIndex;
      view.rows = revealRows(state, q.answerIndex, isFinalIndex(state, state.index));
      if (!isFinalIndex(state, state.index)) {
        const counts = [0, 0, 0, 0];
        let missed = 0;
        for (const row of view.rows) {
          if (row.pickIndex === null) missed++;
          else counts[row.pickIndex] = (counts[row.pickIndex] ?? 0) + 1;
        }
        view.answerDistribution = { counts, missed };
      }
    }
    view.standings = standingsOf(state);
  }
  if (phase === 'wager' || phase === 'done') view.standings = standingsOf(state);
  if (phase === 'wager') view.finalTopic = finalTopicOf(state); // I-550 A
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
  // Own-property checks: an id like "__proto__" must read as a spectator, not Object.prototype.
  const me = Object.hasOwn(state.players, playerId);
  const score = me ? (state.scores[playerId] ?? 0) : 0;
  const myPick = me && Object.hasOwn(state.picks, playerId) ? state.picks[playerId] : undefined;
  const view: LightningControllerView = {
    ...controllerEnvelope(state, gameId, playerId, {
      statusOf: statusOf(state),
      scores: state.scores,
    }),
    // Standalone views have no engine to stamp stage visibility or content language.
    phoneOnly: state.phoneOnly === true || (me && state.players[playerId]?.canSeeTv === false),
    contentLang: state.contentLang ?? 'en',
    // I-288 A: the phone's clock is quiet when the TV's is — nothing to press in the intro or reveal
    timerMode: phase === 'intro' || phase === 'reveal' ? 'quiet' : 'normal',
    round: roundOf(state),
    question: phase === 'question' || phase === 'reveal' ? questionOf(state) : null,
    myPickIndex: myPick?.index ?? null,
    myScore: score,
    myStreak: me ? (state.streaks[playerId] ?? 0) : 0,
    ...nextOf(state),
  };
  const final = isFinalIndex(state, state.index);
  // I-288 B: the live worth of a right answer (the regular questions: the final is the bet)
  if (phase === 'question' && me && !final)
    view.worth = {
      base: BASE_POINTS,
      speedMax: SPEED_MAX_POINTS,
      bonus:
        questionPoints(
          state.settings.answerSeconds * 1000,
          state.settings.answerSeconds,
          (state.streaks[playerId] ?? 0) + 1,
        ) - BASE_POINTS,
      windowMs: state.settings.answerSeconds * 1000,
    };
  if (phase === 'reveal') {
    view.revealAt = revealAtOf(state);
    const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
    if (q) {
      view.correctIndex = q.answerIndex;
      view.outcome = {
        correct: myPick?.index === q.answerIndex,
        delta: me ? (state.lastDelta[playerId] ?? 0) : 0,
      };
      view.rows = revealRows(state, q.answerIndex, final);
    }
  }
  // I-791 D: the phone coming back after a drop names the question ("question 3 of 10"); the
  // final question has its own card, so it is not counted.
  const round = view.round;
  if (round && !round.final && round.total > 0)
    view.progressStep = { unit: 'question', n: round.number, of: round.total };
  if (phase === 'wager' && me) view.wagerChoices = wagerOptions(score);
  if (phase === 'wager') view.finalTopic = finalTopicOf(state); // I-550 A
  const wagerVisible = phase === 'wager' || ((phase === 'question' || phase === 'reveal') && final);
  if (wagerVisible && me && Object.hasOwn(state.wagers, playerId))
    view.myWagerAmount = state.wagers[playerId];
  if (phase === 'done') view.myRank = standingsOf(state).find((r) => r.playerId === playerId)?.rank;
  return view;
}

/** I-550 A: the final question's topic — known since the draw, shown while the wagers are placed. */
export type Topic = Pick<QuestionView, 'categoryLabel' | 'subcategoryLabel' | 'difficulty'>;

function finalTopicOf(state: State): Topic | null {
  const q = questionById(state.questionIds[state.questionIds.length - 1] ?? '', state.contentLang);
  if (!q) return null;
  return {
    categoryLabel: categoryLabel(q.category),
    subcategoryLabel: labelOf(q.subcategory),
    difficulty: q.difficulty,
  };
}
