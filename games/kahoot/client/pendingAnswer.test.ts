import { describe, expect, it, vi } from 'vitest';
import type { DraftStore } from '@partybox/game-sdk/ui';
import { MAX_PENDING_CHARS, parsePending, pendingSnapshot, restorePending } from './pendingAnswer';

function slot(text: string): DraftStore {
  return { read: vi.fn(() => text), write: vi.fn(), clear: vi.fn() };
}

describe('unresolved immutable answer draft', () => {
  it('persists only bounded round and choice, never elapsed timing or extra fields', () => {
    const local = { round: 20, choice: 3, at: 12345, private: 'not persisted' };
    const text = pendingSnapshot(local);
    expect(text).toBe('{"round":20,"choice":3}');
    expect(text.length).toBeLessThanOrEqual(MAX_PENDING_CHARS);
    expect(parsePending(text, 20)).toEqual({ round: 20, choice: 3 });
  });
  it.each([
    '',
    'invalid json',
    'null',
    '[]',
    '{}',
    '{"round":1}',
    '{"choice":1}',
    '{"round":0,"choice":1}',
    '{"round":21,"choice":1}',
    '{"round":1.5,"choice":1}',
    '{"round":"1","choice":1}',
    '{"round":1,"choice":-1}',
    '{"round":1,"choice":4}',
    '{"round":1,"choice":1.5}',
    '{"round":1,"choice":"1"}',
    '{"round":1,"choice":1,"at":0}',
    '{"round":1,"choice":1,"__proto__":{}}',
    ' '.repeat(MAX_PENDING_CHARS) + '{"round":1,"choice":1}',
  ])('rejects malformed or oversized stored value %s', (text) => {
    expect(parsePending(text, 1)).toBeNull();
  });
  it('rejects a previous round and invalid live choices', () => {
    expect(parsePending(pendingSnapshot({ round: 1, choice: 2 }), 2)).toBeNull();
    for (const choice of [-1, 4, 1.5, NaN, Infinity])
      expect(pendingSnapshot({ round: 1, choice })).toBe('');
    expect(pendingSnapshot({ round: 0, choice: 1 })).toBe('');
  });
  it('restores the same choice ready for manual retry without writing, clearing or sending', () => {
    const draft = slot(pendingSnapshot({ round: 3, choice: 2 }));
    expect(restorePending(draft, 3, true, 10_000, 1200)).toEqual({ round: 3, choice: 2, at: 8800 });
    expect(draft.write).not.toHaveBeenCalled();
    expect(draft.clear).not.toHaveBeenCalled();
  });
  it('authoritative submitted, out-of-phase and spectator contexts never read or restore a choice', () => {
    const draft = slot(pendingSnapshot({ round: 1, choice: 3 }));
    expect(restorePending(draft, 1, false, 1000, 1200)).toBeNull();
    expect(draft.read).not.toHaveBeenCalled();
  });
  it('no scope or unavailable draft store safely restores nothing', () => {
    expect(restorePending(slot(''), 1, true, 1000, 1200)).toBeNull();
    const unavailable = {
      ...slot(''),
      read: () => {
        throw new Error('unavailable');
      },
    };
    expect(restorePending(unavailable, 1, true, 1000, 1200)).toBeNull();
    expect(restorePending(slot('{"round":1,"choice":0}'), 1, true, NaN, 1200)).toBeNull();
  });
});
