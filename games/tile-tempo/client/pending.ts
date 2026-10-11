// Predict only disclosed rows. Absolute indices let the server safely ignore replayed inputs.
import type { Input } from '../server/types';

export interface PendingSource {
  phase: string;
  began: number;
  row: number;
  notes: readonly number[];
  player: boolean;
  alive: boolean;
  paused: boolean;
  connected: boolean;
  now: number;
}
interface QueuedTap {
  row: number;
  column: number;
  at: number;
  wrong: boolean;
}
export interface PendingCursor {
  key: string;
  taps: readonly QueuedTap[];
}
export interface Prediction {
  row: number;
  notes: (number | null)[];
  out: boolean;
  enabled: boolean;
  unconfirmed: number;
}

const identity = (source: PendingSource): string =>
  `${source.phase}:${source.began}:${source.paused}:${source.connected}:${source.player}`;

/** No new timer: the SDK's held server clock releases an unacknowledged queue after 750 ms. */
export function reconcilePending(pending: PendingCursor, source: PendingSource): PendingCursor {
  const key = identity(source);
  if (
    pending.key !== key ||
    source.phase !== 'play' ||
    !source.player ||
    !source.alive ||
    source.paused ||
    !source.connected
  ) {
    return pending.key === key && pending.taps.length === 0 ? pending : { key, taps: [] };
  }
  const taps = pending.taps.filter((tap) => tap.row >= source.row);
  const last = taps.at(-1);
  // A later snapshot will reveal an accepted tap. A lost send must not leave the phone stuck.
  if (last && source.now - last.at >= 750) return { key, taps: [] };
  return taps.length === pending.taps.length ? pending : { key, taps };
}

export function predictPending(pending: PendingCursor, source: PendingSource): Prediction {
  const current = reconcilePending(pending, source);
  const unconfirmed = current.taps.filter((tap) => !tap.wrong).length;
  const out = current.taps.some((tap) => tap.wrong);
  const known = source.notes.slice(unconfirmed);
  return {
    row: source.row + unconfirmed,
    notes: Array.from({ length: 4 }, (_, i) => known[i] ?? null),
    out,
    enabled:
      source.phase === 'play' &&
      source.player &&
      source.alive &&
      !source.paused &&
      source.connected &&
      !out &&
      known.length > 0,
    unconfirmed,
  };
}

/** `renderedRow` rejects a late activation from a row that was already replaced on screen. */
export function queueTap(
  pending: PendingCursor,
  source: PendingSource,
  column: number,
  renderedRow: number,
): { pending: PendingCursor; input: Input; wrong: boolean } | null {
  const current = reconcilePending(pending, source);
  const predicted = predictPending(current, source);
  if (
    !predicted.enabled ||
    predicted.row !== renderedRow ||
    !Number.isInteger(column) ||
    column < 0 ||
    column > 3
  )
    return null;
  const wrong = column !== predicted.notes[0];
  return {
    pending: {
      key: current.key,
      taps: [...current.taps, { row: predicted.row, column, at: source.now, wrong }],
    },
    input: { type: 'tap', column, row: predicted.row },
    wrong,
  };
}
