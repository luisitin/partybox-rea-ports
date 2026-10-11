// The glide of cards put on a target (dragged there, or picked and the target tapped): they leave
// the fan at once, and a copy flies from where they were into the target, shrinking to its size and
// fading as it lands; the game's next view shows them there. Under reduced motion there is no glide.
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TableSnapshot, TableStore } from './CardTable';
import type { CardPose, HandGeo } from './handDom';
import type { HandCard } from './types';

/** How long a glide lasts before its copies are dropped (the CSS transition is shorter). */
const FLIGHT_MS = 420;

export interface Flight {
  n: number;
  target: string;
  cards: readonly HandCard[];
  from: ReadonlyMap<string, CardPose>;
  /** The card size in the fan at the drop (the hand's cards may grow once these leave it). */
  w: number;
  h: number;
}

/**
 * Call before the hand updates `geo` in its own layout effect: a tapped card's start is its place
 * in the fan as the previous render laid it out.
 */
export function useFlight(
  table: TableSnapshot,
  store: TableStore,
  fan: RefObject<HTMLDivElement | null>,
  probe: RefObject<HTMLSpanElement | null>,
  geo: RefObject<HandGeo>,
  cards: RefObject<ReadonlyMap<string, HandCard>>,
  landing: RefObject<Map<string, CardPose> | null>,
  still: boolean,
): Flight | null {
  const [flight, setFlight] = useState<Flight | null>(null);
  const seen = useRef(table.flight?.n ?? 0);

  useLayoutEffect(() => {
    const f = table.flight;
    if (!f || f.n === seen.current) return;
    seen.current = f.n;
    const dragged = landing.current;
    landing.current = null;
    const fanEl = fan.current;
    if (!fanEl || still) return;
    const fr = fanEl.getBoundingClientRect();
    const from = new Map<string, CardPose>();
    const flying: HandCard[] = [];
    for (const id of f.ids) {
      const card = cards.current.get(id);
      const slot = geo.current.slots.get(id);
      const pose =
        dragged?.get(id) ??
        (slot
          ? { x: fr.left + slot.x, y: fr.top + slot.y, r: slot.rotate, scale: 1, grab: null }
          : undefined);
      if (!card || !pose) continue;
      from.set(id, pose);
      flying.push(card);
    }
    const { cardW: w, cardH: h } = geo.current;
    if (flying.length > 0) setFlight({ n: f.n, target: f.target, cards: flying, from, w, h });
  }, [table.flight, fan, geo, cards, landing, still]);

  useLayoutEffect(() => {
    const fanEl = fan.current;
    const targetEl = flight ? store.targets.get(flight.target)?.el : null;
    if (!flight || !fanEl) return undefined;
    const origin = probe.current?.getBoundingClientRect();
    const ox = origin?.left ?? 0,
      oy = origin?.top ?? 0;
    const { w, h } = flight;
    const to = targetEl?.getBoundingClientRect();
    const scale = to ? Math.min(1, Math.max(0.2, (to.height * 0.92) / h)) : 1;
    const count = flight.cards.length;
    flight.cards.forEach((card, k) => {
      const el = fanEl.querySelector<HTMLElement>(`[data-fly="${CSS.escape(card.id)}"]`);
      const pose = flight.from.get(card.id);
      if (!el || !pose) return;
      // A dragged card turns about the finger; a card in the fan about its bottom middle.
      const gx = pose.grab ? pose.grab.x : w / 2,
        gy = pose.grab ? pose.grab.y : h;
      el.style.setProperty('--grab-x', `${gx}px`);
      el.style.setProperty('--grab-y', `${gy}px`);
      el.style.transition = 'none';
      el.style.transform = `translate3d(${pose.x - ox}px, ${pose.y - oy}px, 0) rotate(${pose.r}deg) scale(${pose.scale})`;
      void el.offsetWidth;
      el.style.transition = '';
      if (!to) {
        el.style.opacity = '0';
        return;
      }
      // Land the card's middle on the target's middle; a group fans out a little across it.
      const spread = (k - (count - 1) / 2) * w * scale * 0.22;
      const tx = to.left + to.width / 2 + spread - ox - gx - scale * (w / 2 - gx);
      const ty = to.top + to.height / 2 - oy - gy - scale * (h / 2 - gy);
      el.style.transitionDelay = `${k * 40}ms, ${k * 40 + 140}ms`; // transform, then opacity
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(0deg) scale(${scale})`;
      el.style.opacity = '0';
    });
    const timer = window.setTimeout(() => setFlight(null), FLIGHT_MS + count * 40);
    return () => window.clearTimeout(timer);
  }, [flight, fan, probe, store]);

  return flight;
}
