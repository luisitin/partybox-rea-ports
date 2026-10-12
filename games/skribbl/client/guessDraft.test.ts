import { describe, expect, it } from 'vitest';
import {
  acknowledgeGuess,
  editGuess,
  emptyGuessDraft,
  nextGuessRequest,
  pauseGuess,
  restoreGuessDraft,
  saveGuessDraft,
  submitGuess,
} from './guessDraft';
import type { GuessDraft } from './guessDraft';
import { game } from '../server/index';

const empty: GuessDraft = { turn: 1, text: '', edit: 0 };
const pending = (text = 'cat', request = 1): GuessDraft =>
  submitGuess(editGuess(empty, 1, text), 1, request, text);

describe('private guess acknowledgement', () => {
  it('wraps the maximum legal request and advances beyond a stale pre-wrap receipt', () => {
    const receipt = { revision: 30, request: 1_000_000_000, accepted: true };
    let serial = nextGuessRequest(0, receipt);
    expect(serial).toBe(1);
    for (let retry = 0; retry < 3; retry++) {
      expect(
        game.inputSchema.safeParse({ type: 'guess', text: 'cat', request: serial }).success,
      ).toBe(true);
      serial = nextGuessRequest(serial, receipt);
    }
    expect(serial).toBe(4);
  });

  it('correlates a reused request ID only with receipts newer than its submission', () => {
    const wrapped = submitGuess(editGuess(empty, 1, 'cat'), 1, 1, 'cat', 30);
    const old = { revision: 30, request: 1, accepted: false };
    expect(acknowledgeGuess(wrapped, 1, old)).toBe(wrapped);
    expect(acknowledgeGuess(wrapped, 1, { ...old, revision: 31 }).text).toBe('cat');
  });

  it('restores a refused guess so the player can retry without retyping', () => {
    const next = acknowledgeGuess(pending(), 1, { revision: 1, request: 1, accepted: false });
    expect(next.text).toBe('cat');
    expect(next.pending).toBeUndefined();
  });

  it('keeps an accepted guess cleared and hides its pending status', () => {
    const next = acknowledgeGuess(pending(), 1, { revision: 1, request: 1, accepted: true });
    expect(next.text).toBe('');
    expect(next.pending).toBeUndefined();
  });

  it('never overwrites newer typing when an older guess is refused or accepted', () => {
    const newer = editGuess(pending(), 1, 'balloon');
    for (const accepted of [false, true]) {
      const next = acknowledgeGuess(newer, 1, { revision: 1, request: 1, accepted });
      expect(next.text).toBe('balloon');
      expect(next.pending).toBeUndefined();
    }
  });

  it('matches request IDs when identical text is retried with an identical verdict', () => {
    const refused = acknowledgeGuess(pending(), 1, { revision: 1, request: 1, accepted: false });
    const retry = submitGuess(refused, 1, 2, refused.text);
    expect(acknowledgeGuess(retry, 1, { revision: 1, request: 1, accepted: false })).toBe(retry);
    const again = acknowledgeGuess(retry, 1, { revision: 2, request: 2, accepted: false });
    expect(again.text).toBe('cat');
    expect(again.pending).toBeUndefined();
  });

  it('ignores an earlier acknowledgement while a later submission is in flight', () => {
    const latest = submitGuess(editGuess(pending(), 1, 'balloon'), 1, 2, 'balloon');
    expect(acknowledgeGuess(latest, 1, { revision: 1, request: 1, accepted: false })).toBe(latest);
    expect(acknowledgeGuess(latest, 1, { revision: 2, request: 2, accepted: false }).text).toBe(
      'balloon',
    );
  });

  it('processes each acknowledgement once and never restores text from another turn', () => {
    const receipt = { revision: 1, request: 1, accepted: false };
    const restored = acknowledgeGuess(pending(), 1, receipt);
    const cleared = editGuess(restored, 1, '');
    expect(acknowledgeGuess(cleared, 1, receipt)).toBe(cleared);
    expect(acknowledgeGuess(pending(), 2, receipt)).toEqual(pending());
    expect(editGuess(pending(), 2, 'new turn').pending).toBeUndefined();
  });
});

describe('bounded refresh draft recovery', () => {
  const receipt = { revision: 0, accepted: true };
  it('restores unsent private text and its edit counter in the same turn', () => {
    const typed = editGuess(empty, 1, 'hot air balloon');
    expect(restoreGuessDraft(saveGuessDraft(typed), 1, receipt)).toEqual(typed);
  });
  it('keeps unresolved request correlation but offers manual retry instead of indefinite awaiting', () => {
    const restored = restoreGuessDraft(saveGuessDraft(pending('cat', 7)), 1, receipt);
    expect(restored.text).toBe('cat');
    expect(restored.pending).toEqual({ ...pending('cat', 7).pending, paused: true });
    expect(nextGuessRequest(restored.pending!.request, receipt)).toBe(8);
    expect(acknowledgeGuess(restored, 1, { revision: 1, request: 7, accepted: true }).text).toBe(
      '',
    );
  });
  it('processes an accepted refresh receipt before restoring a cleared field', () => {
    const restored = restoreGuessDraft(saveGuessDraft(pending()), 1, {
      revision: 1,
      request: 1,
      accepted: true,
    });
    expect(restored).toEqual({ turn: 1, text: '', edit: pending().edit });
    expect(saveGuessDraft(restored)).toBe('');
  });
  it('restores a refused refresh guess without retaining a resolved request', () => {
    const restored = restoreGuessDraft(saveGuessDraft(pending()), 1, {
      revision: 1,
      request: 1,
      accepted: false,
    });
    expect(restored.text).toBe('cat');
    expect(restored.pending).toBeUndefined();
  });
  it('preserves newer typing across refresh and either later verdict', () => {
    const typed = editGuess(pending(), 1, 'balloon');
    const restored = restoreGuessDraft(saveGuessDraft(typed), 1, receipt);
    for (const accepted of [true, false])
      expect(acknowledgeGuess(restored, 1, { revision: 1, request: 1, accepted }).text).toBe(
        'balloon',
      );
  });
  it('never hydrates another turn and treats empty/no-scope storage as an empty draft', () => {
    expect(restoreGuessDraft(saveGuessDraft(pauseGuess(pending(), 1)), 2, receipt)).toEqual(
      emptyGuessDraft(2),
    );
    expect(restoreGuessDraft('', 1, receipt)).toEqual(emptyGuessDraft(1));
    expect(saveGuessDraft(emptyGuessDraft(1))).toBe('');
  });
  it('rejects malformed, oversized and unbounded snapshots instead of rendering their contents', () => {
    const invalid: unknown[] = [
      null,
      [],
      { ...empty, text: 'x'.repeat(41) },
      { ...empty, edit: -1 },
      { ...empty, edit: 1.5 },
      { ...empty, edit: Number.MAX_SAFE_INTEGER + 1 },
      { ...pending(), unexpected: 'private' },
      { ...pending(), pending: { ...pending().pending, request: 0 } },
      { ...pending(), pending: { ...pending().pending, request: 1_000_000_001 } },
      { ...pending(), pending: { ...pending().pending, edit: 999 } },
      { ...pending(), pending: { ...pending().pending, afterRevision: -1 } },
      { ...pending(), pending: { ...pending().pending, paused: false } },
      { ...pending(), pending: { ...pending().pending, text: 'x'.repeat(41) } },
    ];
    for (const saved of [
      'not JSON',
      'x'.repeat(2049),
      ...invalid.map((value) => JSON.stringify(value)),
    ])
      expect(restoreGuessDraft(saved, 1, receipt)).toEqual(emptyGuessDraft(1));
  });
  it('bounds escaped full snapshots and preserves the stale-revision receipt guard', () => {
    const submitted = submitGuess(
      editGuess(empty, 1, '\\'.repeat(40)),
      1,
      1_000_000_000,
      '\\'.repeat(40),
      30,
    );
    const saved = saveGuessDraft(submitted);
    expect(saved.length).toBeLessThan(2048);
    const restored = restoreGuessDraft(saved, 1, {
      revision: 30,
      request: 1_000_000_000,
      accepted: true,
    });
    expect(restored.text).toBe('\\'.repeat(40));
    expect(restored.pending?.paused).toBe(true);
    expect(nextGuessRequest(restored.pending!.request, receipt)).toBe(1);
    expect(
      acknowledgeGuess(restored, 1, { revision: 31, request: 1_000_000_000, accepted: true }).text,
    ).toBe('');
  });
});

describe('pause preserves an unresolved guess without replaying it', () => {
  it('restores a cleared submission once and retains its request for a later receipt', () => {
    const submitted = pending();
    const paused = pauseGuess(submitted, 1);
    expect(paused.text).toBe('cat');
    expect(paused.edit).toBe(submitted.edit);
    expect(paused.pending).toEqual({ ...submitted.pending, paused: true });
    expect(pauseGuess(paused, 1)).toBe(paused);
    expect(submitted.text).toBe('');
    expect(submitted.pending).not.toHaveProperty('paused');
  });

  it('does not overwrite typing begun before the pause or after recovery', () => {
    const typedBefore = editGuess(pending(), 1, 'balloon');
    const pausedBefore = pauseGuess(typedBefore, 1);
    expect(pausedBefore.text).toBe('balloon');
    const typedAfter = editGuess(pauseGuess(pending(), 1), 1, 'house');
    for (const accepted of [false, true]) {
      expect(acknowledgeGuess(pausedBefore, 1, { revision: 1, request: 1, accepted }).text).toBe(
        'balloon',
      );
      expect(acknowledgeGuess(typedAfter, 1, { revision: 1, request: 1, accepted }).text).toBe(
        'house',
      );
    }
  });

  it('clears only untouched restored text when the original submission was actually accepted', () => {
    const paused = pauseGuess(pending(), 1);
    const accepted = acknowledgeGuess(paused, 1, { revision: 1, request: 1, accepted: true });
    expect(accepted.text).toBe('');
    expect(accepted.pending).toBeUndefined();
    const deliberatelyRetyped = editGuess(paused, 1, 'cat');
    expect(
      acknowledgeGuess(deliberatelyRetyped, 1, { revision: 1, request: 1, accepted: true }).text,
    ).toBe('cat');
  });

  it('keeps a refused restored submission ready for manual retry and ignores duplicate receipts', () => {
    const paused = pauseGuess(pending(), 1);
    const receipt = { revision: 1, request: 1, accepted: false };
    const refused = acknowledgeGuess(paused, 1, receipt);
    expect(refused.text).toBe('cat');
    expect(refused.pending).toBeUndefined();
    const erased = editGuess(refused, 1, '');
    expect(acknowledgeGuess(erased, 1, receipt)).toBe(erased);
  });

  it('processes an accepted receipt before pause recovery so accepted guesses do not reappear', () => {
    const accepted = acknowledgeGuess(pending(), 1, { revision: 1, request: 1, accepted: true });
    expect(pauseGuess(accepted, 1)).toBe(accepted);
    expect(accepted.text).toBe('');
    expect(accepted.pending).toBeUndefined();
  });

  it('uses a new request for manual retry and protects that retry from the old receipt', () => {
    const paused = pauseGuess(pending(), 1);
    const retry = submitGuess(paused, 1, 2, paused.text, 0);
    expect(retry.text).toBe('');
    expect(retry.pending).not.toHaveProperty('paused');
    for (const accepted of [false, true])
      expect(acknowledgeGuess(retry, 1, { revision: 1, request: 1, accepted })).toBe(retry);
    expect(acknowledgeGuess(retry, 1, { revision: 2, request: 2, accepted: false }).text).toBe(
      'cat',
    );
  });

  it('never revives a paused draft on a later turn or applies stale same-request receipts', () => {
    const submitted = submitGuess(empty, 1, 1, 'cat', 30);
    const paused = pauseGuess(submitted, 1);
    expect(pauseGuess(submitted, 2)).toBe(submitted);
    expect(acknowledgeGuess(paused, 1, { revision: 30, request: 1, accepted: true })).toBe(paused);
    expect(acknowledgeGuess(paused, 2, { revision: 31, request: 1, accepted: false })).toBe(paused);
    const newTurn = editGuess(paused, 2, 'new word');
    expect(newTurn.pending).toBeUndefined();
    expect(acknowledgeGuess(newTurn, 2, { revision: 31, request: 1, accepted: true })).toBe(
      newTurn,
    );
  });
});
