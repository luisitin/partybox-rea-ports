// Public payload types: explicit fields prevent accidentally spreading an answer key.
import type { ControllerView, TvView } from '@partybox/game-sdk';
import type { QuizMode, Team, Verdict } from './types';

export interface PublicTeam extends Team {
  score: number;
  gained: number;
  /** Zero means this podium place has not been revealed yet. */
  rank: number;
}

export interface Standing {
  id: string;
  name: string;
  avatarId: string;
  rank: number;
  score: number;
  gained: number;
}
export interface PublicQuestion {
  id: string;
  prompt: string;
  options: string[];
}
export interface RevealData {
  correctChoice: number;
  explanation: string;
  counts: number[];
  missed: number;
}
export interface QuizTvView extends TvView {
  mode: QuizMode;
  team: PublicTeam | null;
  teams: PublicTeam[];
  decision: number | null;
  round: number;
  rounds: number;
  question: PublicQuestion | null;
  reveal: RevealData | null;
  standings: Standing[];
  answered: number;
  eligible: number;
  podiumStep: number;
}
export interface QuizControllerView extends ControllerView {
  mode: QuizMode;
  team: PublicTeam | null;
  teams: PublicTeam[];
  decision: number | null;
  round: number;
  rounds: number;
  question: PublicQuestion | null;
  reveal: RevealData | null;
  standings: Standing[];
  submitted: boolean;
  selected: number | null;
  verdict: Verdict | null;
  score: number;
  rank: number;
  streak: number;
  stage: boolean;
  podiumStep: number;
}
