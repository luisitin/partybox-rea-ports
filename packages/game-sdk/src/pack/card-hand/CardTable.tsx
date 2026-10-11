// CardTable: the shared state between a CardHand and the places its cards can go (CardDropTarget):
// what is selected, what is being dragged, which target is under it, and which cards were just put
// down and wait for the server. A small store read with useSyncExternalStore, so a drag re-renders
// the hand and the targets, never the game's whole screen.
import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import type { CardTableProps } from './types';

/** How long cards put on a target stay hidden from the hand while the server answers. */
export const PENDING_MS = 2500;

export interface TargetEntry {
  el: HTMLElement | null;
  label: string;
  accepts: (ids: readonly string[]) => boolean;
  onDrop: (ids: readonly string[]) => void | false;
  onRefuse: ((ids: readonly string[]) => void) | undefined;
  disabled: boolean;
}

export interface TableSnapshot {
  selected: readonly string[];
  /** The cards on the finger, or null. */
  dragging: readonly string[] | null;
  /** The target the dragged cards are over (pulled in by its magnet), or null. */
  over: string | null;
  /** Cards put on a target, hidden from the hand until the view drops them or `until` passes. */
  pending: readonly { id: string; until: number }[];
  /** The last cards put on a target, for the hand to glide them there; `n` counts the drops. */
  flight: { n: number; ids: readonly string[]; target: string } | null;
}

export interface TableStore {
  get: () => TableSnapshot;
  subscribe: (listener: () => void) => () => void;
  select: (ids: readonly string[]) => void;
  drag: (ids: readonly string[] | null) => void;
  hover: (target: string | null) => void;
  /** Puts `ids` on `target` if it takes them: hides them, clears the selection, calls its onDrop.
   *  A live target that does not take them is told (its onRefuse), so the game can say why. */
  drop: (target: string, ids: readonly string[], now: number) => boolean;
  /** Forgets pending cards that left the hand or whose wait ran out. */
  settle: (inHand: ReadonlySet<string>, now: number) => void;
  targets: Map<string, TargetEntry>;
  /** The game's own selection handler (a CardTable given `onSelect`), or null. */
  listen: (onSelect: ((ids: string[]) => void) | null) => void;
  /** Takes the game's own selection without echoing it back. */
  adopt: (ids: readonly string[]) => void;
}

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

export function createTableStore(): TableStore {
  let snap: TableSnapshot = {
    selected: [],
    dragging: null,
    over: null,
    pending: [],
    flight: null,
  };
  const listeners = new Set<() => void>();
  let onSelect: ((ids: string[]) => void) | null = null;
  const set = (next: Partial<TableSnapshot>): void => {
    snap = { ...snap, ...next };
    for (const l of listeners) l();
  };
  const store: TableStore = {
    get: () => snap,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: (ids) => {
      if (same(ids, snap.selected)) return;
      set({ selected: [...ids] });
      onSelect?.([...ids]);
    },
    drag: (ids) => set({ dragging: ids ? [...ids] : null, over: ids ? snap.over : null }),
    hover: (target) => {
      if (target !== snap.over) set({ over: target });
    },
    drop: (target, ids, now) => {
      const entry = store.targets.get(target);
      if (!entry || entry.disabled || ids.length === 0) return false;
      if (!entry.accepts(ids)) {
        entry.onRefuse?.(ids);
        return false;
      }
      // An onDrop that returns false did not take the cards yet (Uno's Wild asks for a colour
      // first): they stay in the hand, shown, and nothing flies.
      const taken = entry.onDrop(ids) !== false;
      set({
        ...(taken
          ? {
              pending: [...snap.pending, ...ids.map((id) => ({ id, until: now + PENDING_MS }))],
              flight: { n: (snap.flight?.n ?? 0) + 1, ids: [...ids], target },
            }
          : {}),
        dragging: null,
        over: null,
      });
      store.select([]);
      return true;
    },
    settle: (inHand, now) => {
      const pending = snap.pending.filter((p) => inHand.has(p.id) && p.until > now);
      const selected = snap.selected.filter((id) => inHand.has(id));
      if (pending.length !== snap.pending.length) set({ pending });
      if (selected.length !== snap.selected.length) store.select(selected);
    },
    targets: new Map(),
    listen: (handler) => {
      onSelect = handler;
    },
    adopt: (ids) => {
      if (!same(ids, snap.selected)) set({ selected: [...ids] });
    },
  };
  return store;
}

const TableContext = createContext<TableStore | null>(null);

/** The table a hand or a target is in; a hand outside any CardTable keeps one of its own. */
export function useTableStore(): TableStore {
  const outer = useContext(TableContext);
  const [own] = useState(createTableStore);
  return outer ?? own;
}

export function useTable(store: TableStore): TableSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function CardTable({
  children,
  selected,
  onSelect,
  className,
}: CardTableProps): JSX.Element {
  const [store] = useState(createTableStore);
  useLayoutEffect(() => store.listen(onSelect ?? null));
  useLayoutEffect(() => {
    if (selected) store.adopt(selected);
  }, [store, selected]);
  return (
    <TableContext.Provider value={store}>
      <div className={className}>{children}</div>
    </TableContext.Provider>
  );
}
