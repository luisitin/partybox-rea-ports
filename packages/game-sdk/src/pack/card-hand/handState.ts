// CardHand's own state, apart from its gestures: the box it fills, the player's arrangement (kept
// across a reload of the tab), the cards waiting on a target, and the cards that just arrived.
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { TableStore } from './CardTable';
import { reconcileOrder, sortIds } from './handMath';
import { sortId } from './SortBar';
import type { HandCard, HandSort, SortCard } from './types';

/** How long a card that just arrived (a draw) glows. */
const FRESH_MS = 1500;

export function useBoxSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = (): void => {
      const w = el.clientWidth,
        h = el.clientHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export type Arranged = { order: string[]; sort: string | null };
const storageKey = (key: string): string => `partybox:hand:${key}`;
function restore(key: string | undefined): Arranged {
  if (!key) return { order: [], sort: null };
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(key)) ?? 'null') as Arranged | null;
    if (saved && Array.isArray(saved.order))
      return { order: saved.order, sort: saved.sort ?? null };
  } catch {
    /* private mode or a bad entry: start fresh */
  }
  return { order: [], sort: null };
}

/** The hand in the player's order: their moves, or the sort in force, new cards at the end. */
export function useArrangement(
  cards: readonly HandCard[],
  sorts: readonly HandSort[],
  suitOrder: readonly string[] | undefined,
  persistKey: string | undefined,
): { order: string[]; sort: string | null; arrange: (next: Arranged) => void } {
  const [arranged, arrange] = useState<Arranged>(() => restore(persistKey));
  const active = sorts.find((s) => sortId(s) === arranged.sort) ?? null;
  const order = useMemo(
    () =>
      reconcileOrder(
        arranged.order,
        cards,
        active ? (all: readonly SortCard[]) => sortIds(all, active, suitOrder) : null,
      ),
    [arranged.order, cards, active, suitOrder],
  );
  useEffect(() => {
    if (!persistKey) return;
    try {
      sessionStorage.setItem(
        storageKey(persistKey),
        JSON.stringify({ order, sort: arranged.sort }),
      );
    } catch {
      /* private mode: the arrangement lasts until a reload */
    }
  }, [persistKey, order, arranged.sort]);
  return { order, sort: arranged.sort, arrange };
}

/** Cards put on a target hide until the view drops them, or their wait runs out (then they return). */
export function usePending(
  store: TableStore,
  inHand: ReadonlySet<string>,
  pending: readonly unknown[],
): void {
  const [, tick] = useState(0);
  useEffect(() => {
    store.settle(inHand, performance.now());
    const next = Math.min(...store.get().pending.map((p) => p.until));
    if (!Number.isFinite(next)) return undefined;
    const timer = window.setTimeout(
      () => {
        store.settle(inHand, performance.now());
        tick((n) => n + 1);
      },
      Math.max(0, next - performance.now()) + 1,
    );
    return () => window.clearTimeout(timer);
  }, [store, inHand, pending]);
}

/** The cards that just arrived (a draw): they come in from above and glow for a moment. */
export function useFresh(inHand: ReadonlySet<string>): ReadonlySet<string> {
  const [seen, setSeen] = useState(inHand);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  if (seen !== inHand) {
    setSeen(inHand);
    const arrived = [...inHand].filter((id) => !seen.has(id));
    if (arrived.length > 0) setFresh(new Set(arrived));
  }
  useEffect(() => {
    if (fresh.size === 0) return undefined;
    const timer = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, [fresh]);
  return fresh;
}
