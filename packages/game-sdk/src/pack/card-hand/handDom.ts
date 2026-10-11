// What CardHand's gestures share: the hand's last layout, a card's place on screen, and two small
// DOM helpers (find the cards, shake one).
import type { FanOptions } from './handMath';

/** What the hand last laid out, read by the gestures between renders. */
export interface HandGeo {
  w: number;
  h: number;
  options: FanOptions;
  cardW: number;
  cardH: number;
  /** The shown ids in hand order, dragged ones included. */
  shown: readonly string[];
  /** Each resting card's place in the fan box: its unturned top-left (raise included) and turn. */
  slots: ReadonlyMap<string, { x: number; y: number; rotate: number }>;
  /** The top of the highest resting card in the fan box. */
  top: number;
}

/** Where a card is on screen (its unturned top-left, viewport px), its turn and size. */
export interface CardPose {
  x: number;
  y: number;
  r: number;
  scale: number;
  grab: { x: number; y: number } | null;
}

/** The cards' elements in the fan, by id. */
export function cardEls(fan: HTMLElement): Map<string, HTMLElement> {
  const els = new Map<string, HTMLElement>();
  for (const el of fan.querySelectorAll<HTMLElement>('[data-card]'))
    els.set(el.dataset['card'] ?? '', el);
  return els;
}

/** A small shake on an element's `rotate` (it composes with the transform it already has). */
export function shake(el: HTMLElement | undefined, still: boolean): void {
  if (!el || still || typeof el.animate !== 'function') return;
  el.animate({ rotate: ['0deg', '-6deg', '5deg', '-3deg', '0deg'] }, { duration: 380 });
}
