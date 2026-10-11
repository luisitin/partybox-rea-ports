// A remembered choice (ABSTRACTION_AUDIT #23): validated against its choices, kept for the page
// when storage throws (private mode), and announced to every reader of the key.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { landscapeQuery } from './motion';
import { readStoredChoice, subscribeStoredChoice, writeStoredChoice } from './prefs';

const LAYOUTS = ['auto', 'grid', 'list'] as const;

function fakeStorage(throws = false): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (throws) throw new Error('private mode');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new Error('private mode');
      data.set(k, v);
    },
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stored choices', () => {
  it('reads a valid stored value, and falls back on anything else', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    expect(readStoredChoice('t:a', LAYOUTS, 'auto')).toBe('auto');
    storage.setItem('t:a', 'grid');
    expect(readStoredChoice('t:a', LAYOUTS, 'auto')).toBe('grid');
    storage.setItem('t:a', 'sideways');
    expect(readStoredChoice('t:a', LAYOUTS, 'auto')).toBe('auto');
  });

  it('keeps a written choice for the page when storage throws (private mode)', () => {
    vi.stubGlobal('localStorage', fakeStorage(true));
    expect(readStoredChoice('t:b', LAYOUTS, 'auto')).toBe('auto');
    writeStoredChoice('t:b', 'list');
    expect(readStoredChoice('t:b', LAYOUTS, 'auto')).toBe('list');
  });

  it("works with no storage at all, and tells the key's readers (only them) on a write", () => {
    vi.stubGlobal('localStorage', undefined);
    const a = vi.fn();
    const b = vi.fn();
    const stopA = subscribeStoredChoice('t:c', a);
    subscribeStoredChoice('t:d', b);
    writeStoredChoice('t:c', 'grid');
    expect(readStoredChoice('t:c', LAYOUTS, 'auto')).toBe('grid');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    stopA();
    writeStoredChoice('t:c', 'list');
    expect(a).toHaveBeenCalledTimes(1);
  });
});

describe('landscapeQuery', () => {
  it('is any landscape, or landscape up to a height', () => {
    expect(landscapeQuery()).toBe('(orientation: landscape)');
    expect(landscapeQuery(420)).toBe('(orientation: landscape) and (max-height: 420px)');
  });
});
