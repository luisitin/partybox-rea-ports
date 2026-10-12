import type { GuessReceipt } from '../server/types';

export interface GuessDraft {
  turn: number;
  text: string;
  edit: number;
  pending?: { request: number; text: string; edit: number; afterRevision: number; paused?: true };
}

export function emptyGuessDraft(turn: number): GuessDraft {
  return { turn, text: '', edit: 0 };
}

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 40;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Only a small private snapshot belongs in the SDK's per-tab, shell-scoped draft slot. */
function validDraft(value: unknown): value is GuessDraft {
  if (!object(value) || !integer(value.turn) || !integer(value.edit) || !text(value.text))
    return false;
  if (Object.keys(value).some((key) => !['turn', 'text', 'edit', 'pending'].includes(key)))
    return false;
  const pending = value.pending;
  if (pending === undefined) return true;
  return (
    object(pending) &&
    Object.keys(pending).every((key) =>
      ['request', 'text', 'edit', 'afterRevision', 'paused'].includes(key),
    ) &&
    integer(pending.request) &&
    pending.request >= 1 &&
    pending.request <= 1_000_000_000 &&
    text(pending.text) &&
    integer(pending.edit) &&
    pending.edit <= value.edit &&
    integer(pending.afterRevision) &&
    (pending.paused === undefined || pending.paused === true)
  );
}

export function saveGuessDraft(draft: GuessDraft): string {
  return validDraft(draft) && (draft.text !== '' || draft.pending !== undefined)
    ? JSON.stringify(draft)
    : '';
}

/** Reconcile the pushed receipt first; unresolved refresh intent is offered for manual retry. */
export function restoreGuessDraft(saved: string, turn: number, receipt: GuessReceipt): GuessDraft {
  if (!saved || saved.length > 2048) return emptyGuessDraft(turn);
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!validDraft(parsed) || parsed.turn !== turn) return emptyGuessDraft(turn);
    return pauseGuess(acknowledgeGuess(parsed, turn, receipt), turn);
  } catch {
    return emptyGuessDraft(turn);
  }
}

/** Seed after refresh, then advance locally so a pre-wrap receipt cannot reuse an in-flight ID. */
export function nextGuessRequest(serial: number, receipt: GuessReceipt): number {
  const previous = serial || Math.max(receipt.revision, receipt.request ?? 0);
  return previous >= 1_000_000_000 ? 1 : previous + 1;
}

export function editGuess(draft: GuessDraft, turn: number, text: string): GuessDraft {
  return {
    ...draft,
    turn,
    text,
    edit: draft.edit + 1,
    ...(draft.turn === turn ? {} : { pending: undefined }),
  };
}

export function submitGuess(
  draft: GuessDraft,
  turn: number,
  request: number,
  text: string,
  afterRevision = 0,
): GuessDraft {
  const edit = draft.edit + 1;
  return { turn, text: '', edit, pending: { request, text, edit, afterRevision } };
}

/** A pause can refuse an in-flight input without a receipt; retain its intent, never resend it. */
export function pauseGuess(draft: GuessDraft, turn: number): GuessDraft {
  if (draft.turn !== turn || !draft.pending || draft.pending.paused) return draft;
  const text =
    draft.edit === draft.pending.edit && draft.text === '' ? draft.pending.text : draft.text;
  return { ...draft, text, pending: { ...draft.pending, paused: true } };
}

/** Restore a refused guess only while its cleared field is untouched; an older ack never wins. */
export function acknowledgeGuess(
  draft: GuessDraft,
  turn: number,
  receipt: GuessReceipt,
): GuessDraft {
  if (
    draft.turn !== turn ||
    !draft.pending ||
    draft.pending.request !== receipt.request ||
    receipt.revision <= draft.pending.afterRevision
  )
    return draft;
  const untouched = draft.edit === draft.pending.edit;
  const text =
    !receipt.accepted && untouched
      ? draft.pending.text
      : receipt.accepted && draft.pending.paused && untouched && draft.text === draft.pending.text
        ? ''
        : draft.text;
  return { turn: draft.turn, text, edit: draft.edit, pending: undefined };
}
