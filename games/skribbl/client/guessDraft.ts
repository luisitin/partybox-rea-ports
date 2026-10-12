import type { GuessReceipt } from '../server/types';

export interface GuessDraft {
  turn: number;
  text: string;
  edit: number;
  pending?: { request: number; text: string; edit: number; afterRevision: number };
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
  const text =
    !receipt.accepted && draft.edit === draft.pending.edit ? draft.pending.text : draft.text;
  return { turn: draft.turn, text, edit: draft.edit, pending: undefined };
}
