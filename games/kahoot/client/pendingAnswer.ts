// Only an unresolved immutable choice is persisted. Timing belongs to this mounted phone.
import type { DraftStore } from '@partybox/game-sdk/ui';

export interface PendingChoice {
  round: number;
  choice: number;
}
export interface PendingAnswer extends PendingChoice {
  at: number;
}
export const MAX_PENDING_CHARS = 64;

function valid(value: unknown): value is PendingChoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    Object.keys(entry).length === 2 &&
    Object.hasOwn(entry, 'round') &&
    Object.hasOwn(entry, 'choice') &&
    typeof entry.round === 'number' &&
    Number.isInteger(entry.round) &&
    entry.round >= 1 &&
    entry.round <= 20 &&
    typeof entry.choice === 'number' &&
    Number.isInteger(entry.choice) &&
    entry.choice >= 0 &&
    entry.choice <= 3
  );
}

export function pendingSnapshot(value: PendingChoice): string {
  const choice = { round: value.round, choice: value.choice };
  return valid(choice) ? JSON.stringify(choice) : '';
}

export function parsePending(text: string, round: number): PendingChoice | null {
  if (!text || text.length > MAX_PENDING_CHARS) return null;
  try {
    const value: unknown = JSON.parse(text);
    return valid(value) && value.round === round
      ? { round: value.round, choice: value.choice }
      : null;
  } catch {
    return null;
  }
}

/** Hydration enables only an explicit same-choice retry; it never invokes a send. */
export function restorePending(
  slot: DraftStore,
  round: number,
  allowed: boolean,
  now: number,
  retryAfter: number,
): PendingAnswer | null {
  if (!allowed || !Number.isFinite(now) || !Number.isFinite(retryAfter) || retryAfter < 0)
    return null;
  try {
    const choice = parsePending(slot.read(), round);
    return choice ? { ...choice, at: now - retryAfter } : null;
  } catch {
    return null;
  }
}
