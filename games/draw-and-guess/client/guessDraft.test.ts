import { describe, expect, it } from 'vitest';
import { acknowledgeGuess, editGuess, nextGuessRequest, submitGuess } from './guessDraft';
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
