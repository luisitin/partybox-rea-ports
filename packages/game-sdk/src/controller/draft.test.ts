import { describe, expect, it } from 'vitest';
import { draftKey, tidyDrafts } from './draft';

/** A Map-backed Storage (no DOM in these tests). */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(entries));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('T-0218: answer drafts in sessionStorage', () => {
  it('a new phase drops the drafts of the moment before and keeps its own and other keys', () => {
    const now = 'ABCD|p1|wisecrack|answer';
    const s = memoryStorage({
      [draftKey(now, 'q1')]: 'mine',
      [draftKey(now, undefined)]: 'no prompt key',
      [draftKey('ABCD|p1|wisecrack|intro', 'q1')]: 'stale phase',
      [draftKey('ABCD|p1|wisecrack|answer2', 'q1')]: 'a phase whose id starts the same',
      [draftKey('WXYZ|p1|wisecrack|answer', 'q1')]: 'another room',
      'pb:tvRoom': 'ABCD',
    });
    tidyDrafts(s, now);
    expect(s.getItem(draftKey(now, 'q1'))).toBe('mine');
    expect(s.getItem(draftKey(now, undefined))).toBe('no prompt key');
    expect(s.length).toBe(3); // the two drafts of this moment + the unrelated key
    expect(s.getItem('pb:tvRoom')).toBe('ABCD');
  });

  it('no scope (left the game) drops every draft', () => {
    const s = memoryStorage({ [draftKey('A|p|g|x', 'k')]: 'x', other: 'y' });
    tidyDrafts(s, null);
    expect(s.length).toBe(1);
    expect(s.getItem('other')).toBe('y');
  });
});
