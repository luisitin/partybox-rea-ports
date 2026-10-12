import type { ControllerView, TvView } from '@partybox/game-sdk';
import type { GroupMode, QuizMode } from './types';
import type { WagerOption } from './scoring';
import type { StandingRow } from './standings';
export type { StandingRow } from './standings';

export interface RoundView {
  number: number;
  /** Wager: regular count. Classic: exact total, with no extra finale. */
  total: number;
  /** Special wager finale only. */
  final: boolean;
  last?: boolean;
}
export interface QuestionView {
  id: string;
  categoryLabel: string;
  subcategoryLabel: string;
  difficulty: string;
  text: string;
  choices: string[];
}
export interface AnswerStamp {
  questionId: string;
  questionStartedAt: number;
}
export interface RevealRow {
  playerId: string;
  name: string;
  avatarId: string;
  connected: boolean;
  pickIndex: number | null;
  correct: boolean;
  delta: number;
  streak: number;
  score: number;
  wagerAmount?: number;
  elapsedMs?: number;
}
export interface PodiumView {
  rank: 1 | 2 | 3;
  revealedRanks: number[];
  /** Only occupied tiers already unveiled, never the full standings. */
  entries: StandingRow[];
  beatAt: number;
}
export type RevealNext = 'question' | 'wager' | 'podium';
export type Topic = Pick<QuestionView, 'categoryLabel' | 'subcategoryLabel' | 'difficulty'>;
export interface AnswerDistribution {
  counts: number[];
  missed: number;
}
export interface Outcome {
  correct: boolean;
  delta: number;
  answered?: boolean;
  /** Classic: server-calculated base+speed and streak portions. */
  base?: number;
  bonus?: number;
}
export interface GroupView {
  mode: GroupMode;
  teams: {
    id: string;
    name: string;
    members: string[];
    score: number;
    gained: number;
    rank: number;
    /** Present only after the current team answers are publicly revealed. */
    correctPercent?: number;
  }[];
  myTeamId?: string;
  /** Departures among only the fixed members already public in teams; distinct from connection. */
  leftMembers?: string[];
  /** Only present after reveal and when at least one room vote was cast. */
  decision?: number;
  roomStreak?: number;
}
export interface LightningTvView extends TvView {
  group?: GroupView;
  contentLang?: 'en' | 'es';
  questionLang: 'en' | 'es';
  quizMode: QuizMode;
  categoryLabel: string;
  round: RoundView | null;
  question: QuestionView | null;
  answeredCount: number;
  totalCount: number;
  answerStamp?: AnswerStamp;
  correctIndex?: number;
  explanation?: string;
  revealAt?: number;
  /** Group-only shared transition from native answer results to authored explanation. */
  explanationAt?: number;
  leaderboardAt?: number;
  /** The reading-safe Next beat, including the final classic chart before the podium. */
  nextAt?: number;
  rows?: RevealRow[];
  answerDistribution?: AnswerDistribution;
  finalTopic?: Topic | null;
  standings?: StandingRow[];
  next?: RevealNext;
  podium?: PodiumView;
}
export interface LightningControllerView extends ControllerView {
  group?: GroupView;
  contentLang?: 'en' | 'es';
  questionLang: 'en' | 'es';
  quizMode: QuizMode;
  /** Temporary disconnections remain participants; a permanent departure does not. */
  participating: boolean;
  showStage: boolean;
  /** Public TV data for remote, phone-only, spectator and departed phones in either mode. */
  stage: LightningTvView | null;
  round: RoundView | null;
  question: QuestionView | null;
  answerStamp?: AnswerStamp;
  myPickIndex: number | null;
  myScore: number;
  myStreak: number;
  correctIndex?: number;
  explanation?: string;
  answerDistribution?: AnswerDistribution;
  outcome?: Outcome;
  rows?: RevealRow[];
  standings?: StandingRow[];
  next?: RevealNext;
  revealAt?: number;
  /** Present only during a group reveal with an authored explanation. */
  explanationAt?: number;
  leaderboardAt?: number;
  /** The reading-safe Next beat; independent from whether a scoreboard is shown. */
  nextAt?: number;
  worth?: { base: number; speedMax: number; bonus: number; windowMs: number };
  finalTopic?: Topic | null;
  wagerChoices?: WagerOption[];
  myWagerAmount?: number;
  myRank?: number;
  podium?: PodiumView;
}
