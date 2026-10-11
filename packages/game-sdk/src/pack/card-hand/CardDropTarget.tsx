// CardDropTarget: a place cards can go (a pile, a phase slot, a player's run). It is a button, so a
// card can also be put here by tapping it, then tapping the target (and by keyboard). While a card is
// on the finger or selected, a target that takes it glows; under the card it brightens, or turns red
// and refuses.
import { useLayoutEffect, useRef } from 'react';
import type { JSX } from 'react';
import { buzz } from '../../ui/haptics';
import { useT } from '../../ui/lang';
import { useTable, useTableStore } from './CardTable';
import { STRINGS } from './strings';
import type { CardDropTargetProps } from './types';
import styles from './CardHand.module.css';

export function CardDropTarget({
  id,
  label,
  accepts,
  onDrop,
  onRefuse,
  onTap,
  disabled = false,
  children,
  className,
}: CardDropTargetProps): JSX.Element {
  const L = useT(STRINGS);
  const store = useTableStore();
  const table = useTable(store);
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    store.targets.set(id, { el: ref.current, label, accepts, onDrop, onRefuse, disabled });
  });
  useLayoutEffect(
    () => () => {
      store.targets.delete(id);
    },
    [store, id],
  );
  const cards = table.dragging ?? (table.selected.length > 0 ? table.selected : null);
  const takes = !disabled && cards !== null && accepts(cards);
  const over = table.over === id;
  const state = over ? (takes ? 'over' : 'refuse') : takes ? 'ready' : 'idle';
  const tappable = !disabled && (cards ? takes : !!onTap);
  const name = !cards
    ? label
    : takes
      ? cards.length === 1
        ? L('{target}: put the selected card here', { target: label })
        : L('{target}: put the {n} selected cards here', { target: label, n: cards.length })
      : L('{target}: the selected cards cannot go here', { target: label });
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.target} ${className ?? ''}`}
      data-card-target={id}
      data-state={state}
      aria-label={name}
      aria-disabled={!tappable}
      onClick={() => {
        if (disabled) return;
        const picked = store.get().selected;
        if (picked.length > 0) {
          if (!store.drop(id, picked, performance.now())) buzz([25, 40, 25]);
          else buzz(15);
        } else onTap?.();
      }}
    >
      {children}
    </button>
  );
}
