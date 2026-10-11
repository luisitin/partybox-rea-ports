// A lost acknowledgement cannot lock the keyboard; the accepted board identifies a cleared draft.
import type { WordGuessControllerView } from '../server/index';

export const SUBMISSION_WAIT_MS = 3000;

export interface Draft {
  round: number;
  guessCount: number;
  version: number;
  value: string;
}

export interface Pending {
  round: number;
  version: number;
  sentAt: number;
}

type SubmissionView = Pick<
  WordGuessControllerView,
  'phaseId' | 'round' | 'submissionVersion' | 'guesses' | 'error' | 'finished'
>;

export interface SubmissionState {
  value: string;
  waiting: boolean;
  timedOut: boolean;
  error: string | null;
}

export function submissionState(
  view: SubmissionView,
  draft: Draft,
  pending: Pending | null,
  now: number,
): SubmissionState {
  const sameBoard = draft.round === view.round && draft.guessCount === view.guesses.length;
  const awaiting =
    view.phaseId === 'guess' &&
    !view.finished &&
    pending !== null &&
    pending.round === view.round &&
    pending.version === view.submissionVersion;
  const waiting = awaiting && now < pending.sentAt + SUBMISSION_WAIT_MS;
  return {
    value: sameBoard ? draft.value : '',
    waiting,
    timedOut: awaiting && !waiting && sameBoard,
    // Editing records the latest version, so an older rejection cannot follow the new draft.
    error: sameBoard && draft.version < view.submissionVersion ? view.error : null,
  };
}
