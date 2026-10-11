// CardTable's store (CardTable.tsx): a drop the target takes hides the cards and clears the pick; one
// it refuses tells the target (onRefuse) so the game can say why; a target that is off says nothing.
import { describe, expect, it } from 'vitest';
import { createTableStore, PENDING_MS } from './CardTable';
import type { TargetEntry } from './CardTable';

function setTarget(log: string[], disabled = false): TargetEntry {
  return {
    el: null,
    label: 'Set of 3',
    accepts: (ids) => ids.length >= 3,
    onDrop: (ids) => {
      log.push(`drop ${ids.join(' ')}`);
    },
    onRefuse: (ids) => log.push(`refuse ${ids.join(' ')}`),
    disabled,
  };
}

describe('CardTable store', () => {
  it('a refused drop tells the target and keeps the pick; a taken one hides the cards', () => {
    const store = createTableStore();
    const log: string[] = [];
    store.targets.set('set', setTarget(log));
    store.select(['a', 'b']);
    expect(store.drop('set', ['a', 'b'], 100)).toBe(false);
    expect(log).toEqual(['refuse a b']);
    expect(store.get().selected).toEqual(['a', 'b']);
    expect(store.get().pending).toEqual([]);
    expect(store.drop('set', ['a', 'b', 'c'], 100)).toBe(true);
    expect(log).toEqual(['refuse a b', 'drop a b c']);
    expect(store.get().selected).toEqual([]);
    expect(store.get().pending).toEqual(
      ['a', 'b', 'c'].map((id) => ({ id, until: 100 + PENDING_MS })),
    );
    expect(store.get().flight).toMatchObject({ n: 1, ids: ['a', 'b', 'c'], target: 'set' });
  });

  it('a target that is off, or gone, refuses without a word', () => {
    const store = createTableStore();
    const log: string[] = [];
    store.targets.set('set', setTarget(log, true));
    expect(store.drop('set', ['a'], 0)).toBe(false);
    expect(store.drop('set', ['a', 'b', 'c'], 0)).toBe(false);
    expect(store.drop('nowhere', ['a'], 0)).toBe(false);
    expect(log).toEqual([]);
  });
});
