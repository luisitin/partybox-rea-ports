// CardHand: the player's cards as one fan along the bottom of the phone (docs/sdk/card-hand.md).
// Tap to pick (a picked card rises), press and slide to rearrange (the others open a gap), drag onto
// a CardDropTarget to play (or pick, then tap the target), sort with one tap. Every card stays whole
// on screen at any count: the fan overlaps down to a readable sliver, then adds a row. The
// arrangement is the phone's own (the server never sees it) and survives a reload of the tab.
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import { buzz } from '../../ui/haptics';
import { useT } from '../../ui/lang';
import { usePrefersReducedMotion } from '../../ui/motion';
import { CardButton } from './CardButton';
import type { CardOn } from './CardButton';
import { useTable, useTableStore } from './CardTable';
import { cardEls, shake } from './handDom';
import type { CardPose, HandGeo } from './handDom';
import { CARD_ASPECT, fanLayout, moveIds, sortIds } from './handMath';
import type { Slot } from './handMath';
import { useArrangement, useBoxSize, useFresh, usePending } from './handState';
import { SortBar, sortId } from './SortBar';
import { STRINGS } from './strings';
import type { CardHandProps, HandCard, HandSort } from './types';
import { useFlight } from './useFlight';
import { useHandDrag } from './useHandDrag';
import styles from './CardHand.module.css';

const DEFAULT_SORTS: readonly HandSort[] = ['rank', 'suit'];
/** A highlighted (playable) card stands this share of a picked card's rise above the rest. */
const GLOW_RAISE = 0.45;

export function CardHand({
  cards,
  label,
  multi = false,
  highlight = [],
  highlightLabel,
  dimmed = [],
  sorts = DEFAULT_SORTS,
  suitOrder,
  persistKey,
  aspect = CARD_ASPECT,
  frame = 'paper',
  radius = 0.09,
  tapAgain,
  onDimmedTap,
  className,
}: CardHandProps): JSX.Element {
  const L = useT(STRINGS);
  const still = usePrefersReducedMotion();
  const store = useTableStore();
  const table = useTable(store);
  const fan = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const size = useBoxSize(fan);
  const { order, sort, arrange } = useArrangement(cards, sorts, suitOrder, persistKey);
  const [said, say] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const hint = useId();
  const inHand = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);
  usePending(store, inHand, table.pending);
  const fresh = useFresh(inHand);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const hidden = new Set(table.pending.map((p) => p.id));
  const shown = order.filter((id) => byId.has(id) && !hidden.has(id));
  const lifted = (table.dragging ?? []).filter((id) => shown.includes(id));
  const resting = shown.filter((id) => !lifted.includes(id));
  const picked = new Set(table.selected);
  const glow = new Set(highlight);
  const dim = new Set(dimmed);
  const options = useMemo(() => ({ aspect }), [aspect]);

  // Read by the gestures between renders (written after each render, below).
  const geo = useRef<HandGeo>({
    w: 0,
    h: 0,
    options,
    cardW: 0,
    cardH: 0,
    shown: [],
    slots: new Map(),
    top: 0,
  });
  const stillRef = useRef(still);
  const cardsRef = useRef<ReadonlyMap<string, HandCard>>(byId);
  const landing = useRef<Map<string, CardPose> | null>(null);

  /** Puts `ids` at place `gap` among the other shown cards and says where they went; false (and
   *  silent) when that is where they already were. */
  const moveTo = (ids: readonly string[], gap: number): boolean => {
    const rest = shown.filter((id) => !ids.includes(id));
    const all = order.filter((id) => !ids.includes(id));
    const anchor = rest[gap];
    const last = rest[rest.length - 1];
    const to =
      anchor !== undefined ? all.indexOf(anchor) : last ? all.indexOf(last) + 1 : all.length;
    const next = moveIds(order, ids, to);
    if (next.every((id, k) => id === order[k])) return false;
    arrange({ order: next, sort: null });
    const now = next.filter((id) => shown.includes(id));
    const at = now.indexOf(ids[0] ?? '') + 1;
    say(
      ids.length === 1
        ? L('{card} moved to {i} of {n}', {
            card: byId.get(ids[0] ?? '')?.label ?? '',
            i: at,
            n: now.length,
          })
        : L('{n} cards moved to {i} of {n2}', { n: ids.length, i: at, n2: now.length }),
    );
    return true;
  };

  const tap = (id: string, now: number): void => {
    const el = fan.current ? cardEls(fan.current).get(id) : undefined;
    const selected = store.get().selected;
    if (dim.has(id) && onDimmedTap) {
      shake(el, still);
      buzz([25, 40, 25]);
      onDimmedTap(id);
      return;
    }
    if (tapAgain && !multi && selected.length === 1 && selected[0] === id) {
      if (store.drop(tapAgain, [id], now)) buzz(15);
      else {
        shake(el, still);
        buzz([25, 40, 25]);
      }
      return;
    }
    buzz(6);
    if (multi)
      store.select(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else store.select(selected.length === 1 && selected[0] === id ? [] : [id]);
  };

  const drag = useHandDrag({
    fan,
    probe,
    store,
    geo,
    still: stillRef,
    onMove: moveTo,
    onTap: tap,
    landing,
  });
  const gap = lifted.length > 0 ? drag.gap : null;
  const layout = fanLayout(resting.length + (gap === null ? 0 : 1), size.w, size.h, options);
  // A lifted card keeps the size it had in the whole hand.
  const whole = fanLayout(shown.length, size.w, size.h, options);
  const slotOf = new Map<string, Slot>();
  let s = 0;
  for (const id of resting) {
    if (gap === s) s += 1;
    const slot = layout.slots[s];
    if (slot) slotOf.set(id, slot);
    s += 1;
  }
  const raise = (id: string): number =>
    picked.has(id) ? layout.lift : glow.has(id) ? layout.lift * GLOW_RAISE : 0;

  const flight = useFlight(table, store, fan, probe, geo, cardsRef, landing, still);
  useLayoutEffect(() => {
    stillRef.current = still;
    cardsRef.current = byId;
    geo.current = {
      w: size.w,
      h: size.h,
      options,
      cardW: whole.cardW,
      cardH: whole.cardH,
      shown,
      slots: new Map(
        [...slotOf].map(([id, sl]) => [id, { x: sl.x, y: sl.y - raise(id), rotate: sl.rotate }]),
      ),
      top: Math.min(size.h, ...layout.slots.map((sl) => sl.y)),
    };
  });

  const sortBy = (by: HandSort): void => {
    if (store.get().dragging) return;
    arrange({ order: sortIds(cards, by, suitOrder), sort: sortId(by) });
    buzz(8);
    say(
      by === 'rank'
        ? L('Sorted by number')
        : by === 'suit'
          ? L('Sorted by colour')
          : by === 'sets'
            ? L('Equal numbers together')
            : L('Sorted: {sort}', { sort: by.label }),
    );
  };

  // Arrows move between cards, Home / End to the ends; with Alt they move the card itself.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const id = (e.target as HTMLElement).dataset['card'];
    if (!id || store.get().dragging) return;
    const i = shown.indexOf(id);
    const keys: Record<string, number> = {
      ArrowLeft: i - 1,
      ArrowRight: i + 1,
      Home: 0,
      End: shown.length - 1,
    };
    const j = keys[e.key];
    if (j === undefined || i < 0) return;
    e.preventDefault();
    const k = Math.max(0, Math.min(shown.length - 1, j));
    if (e.altKey) {
      if (k !== i) moveTo([id], k);
    } else if (fan.current)
      cardEls(fan.current)
        .get(shown[k] ?? '')
        ?.focus();
  };

  // A played card's button leaves the page and focus would fall to the body: hand it to the card
  // that took its place, so a keyboard or switch player goes on from there.
  const before = useRef<readonly string[]>([]);
  useLayoutEffect(() => {
    const was = before.current;
    before.current = shown;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (active === null || shown.includes(active) || !lost || !fan.current) return;
    const i = was.indexOf(active);
    const next = i < 0 ? undefined : shown[Math.min(i, shown.length - 1)];
    if (next !== undefined) cardEls(fan.current).get(next)?.focus();
  });

  // One set of card handlers for the hand's life (the memoised cards keep it): they reach the
  // latest pick through `tapRef`.
  const tapRef = useRef(tap);
  useLayoutEffect(() => {
    tapRef.current = tap;
  });
  const [on] = useState<CardOn>(() => ({
    ...drag.handlers,
    onClick: (e) => {
      // A quick tap picks here; after a lift the press already decided (a slow tap picked its own
      // card, a drag moved it), so the click is not this card's.
      const id = e.currentTarget.dataset['card'];
      if (!id || (e.detail !== 0 && drag.swallowClick())) return;
      tapRef.current(id, e.timeStamp);
    },
    onFocus: (e) => setActive(e.currentTarget.dataset['card'] ?? null),
  }));

  const focusable = active !== null && shown.includes(active) ? active : (shown[0] ?? null);

  return (
    <div className={`${styles.hand} ${className ?? ''}`} data-frame={frame}>
      {sorts.length > 0 ? (
        <SortBar count={shown.length} sorts={sorts} active={sort} onSort={sortBy} />
      ) : null}
      <div
        ref={fan}
        className={styles.fan}
        role="group"
        aria-label={label}
        aria-describedby={hint}
        data-card-hand=""
        data-dragging={lifted.length > 0 || undefined}
        style={{ '--card-r': `${radius * 100}% / ${radius * aspect * 100}%` } as CSSProperties}
        onKeyDown={onKeyDown}
        onPointerDownCapture={drag.onPressCapture}
        onClick={(e) => {
          // A tap on the table between cards puts a picked card back down; the click after a lift
          // (the card left the finger, so it lands here) does not.
          if (e.target !== e.currentTarget || store.get().dragging) return;
          if (!drag.swallowClick()) store.select([]);
        }}
      >
        <span ref={probe} className={styles.probe} aria-hidden="true" />
        <span id={hint} hidden>
          {L(
            'Tap to pick a card. Drag to rearrange, or onto where it goes. Alt and the arrow keys move a card.',
          )}
        </span>
        {shown.map((id, i) => {
          const card = byId.get(id)!;
          const note = glow.has(id) ? highlightLabel : dim.has(id) ? L('not playable now') : '';
          const at = { card: card.label, i: i + 1, n: shown.length };
          const k = lifted.indexOf(id);
          const slot = k < 0 ? slotOf.get(id) : undefined;
          return (
            <CardButton
              key={id}
              id={id}
              face={card.face}
              name={note ? L('{card}, {i} of {n}, {note}', { ...at, note }) : L('{card}, {i} of {n}', at)} // prettier-ignore
              focusable={id === focusable}
              picked={picked.has(id)}
              lifted={!slot}
              glow={glow.has(id)}
              dim={dim.has(id)}
              fresh={fresh.has(id)}
              w={slot ? layout.cardW : whole.cardW}
              h={slot ? layout.cardH : whole.cardH}
              z={slot ? i + 1 : 1000 - k}
              x={slot?.x ?? 0}
              y={slot?.y ?? 0}
              rotate={slot?.rotate ?? 0}
              lift={slot ? layout.lift : 0}
              on={on}
            />
          );
        })}
        {flight?.cards.map((card) => (
          <span
            key={`fly-${flight.n}-${card.id}`}
            className={styles.card}
            data-fly={card.id}
            aria-hidden="true"
            style={{ width: flight.w, height: flight.h }}
          >
            <span className={styles.skin}>{card.face}</span>
          </span>
        ))}
      </div>
      <p className={styles.said} aria-live="polite">
        {said}
      </p>
    </div>
  );
}
