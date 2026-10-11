// The tally build (T-0287, options/T-0264 idea 1): a result that is counted, not announced. Voters'
// faces arc from where they are (the TV strip's chips) to the card they voted for, each landing
// ticks that card's count, and "+N" tokens leave the winning card for the author's chip. A game
// describes WHAT travels (`useTally(flights)`) and marks WHERE with `data-tally-key`; this file
// measures, draws and reports the landings. The TV surface only: the phone has no strip to fly
// from, so it just waits out `lastLanding(...)` with `useHold` and shows the finished result.
import { useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Avatar } from './Avatar';
import { usePrefersReducedMotion } from './motion';
import {
  durOf,
  flightPose,
  kindOf,
  landedAt,
  lastLanding,
  flightOpacity,
  popIn,
  progress,
  signature,
  withoutFlight,
} from './tallyMath';
import type { Box, TallyFlightSpec } from './tallyMath';
import styles from './Tally.module.css';

/** The `data-tally-key` a TV strip chip carries (PlayerChips sets it on every chip's `<li>`). */
export const tallyChipKey = (playerId: string): string => `chip:${playerId}`;

export interface Tally {
  /** Reduced motion: nothing flies, landings still happen in order. */
  reduced: boolean;
  /** The schedule in force (reduced motion applied). */
  flights: readonly TallyFlightSpec[];
  /** True once the flight with this id has landed. */
  landed: (id: string) => boolean;
  /** How many flights matching `pick` have landed (a card's vote count). */
  count: (pick: (f: TallyFlightSpec) => boolean) => number;
  /** Props for the element a flight lands on: found by the overlay, hidden until the landing, pops on it. */
  slot: (id: string) => { 'data-tally-key': string; className: string };
  /** ms the tally started, in `performance.now()` terms (the overlay's clock). */
  start: number;
}

/** Start a tally when the caller mounts (remount with a `key` to restart it). `sinceMs` is how far
 *  into the schedule the room already is at mount (`useServerElapsed(startedAt)`): a TV that reloads
 *  mid-reveal joins the flights in the air and shows the landed ones as landed, not replayed. */
export function useTally(specs: readonly TallyFlightSpec[], sinceMs = 0): Tally {
  const reduced = usePrefersReducedMotion();
  const flights = reduced ? specs.map(withoutFlight) : specs;
  const [start] = useState(() => performance.now() - Math.max(0, sinceMs));
  const sig = signature(flights);
  const [done, setDone] = useState<ReadonlySet<string>>(
    () => new Set(flights.filter((f) => landedAt(f) <= Math.max(0, sinceMs)).map((f) => f.id)),
  );
  useEffect(() => {
    const elapsed = performance.now() - start;
    const add = (ids: string[]): void =>
      setDone((prev) => (ids.every((i) => prev.has(i)) ? prev : new Set([...prev, ...ids])));
    const now: string[] = [];
    const handles: ReturnType<typeof setTimeout>[] = [];
    for (const f of flights) {
      const wait = landedAt(f) - elapsed;
      if (wait <= 0) now.push(f.id);
      else handles.push(setTimeout(() => add([f.id]), wait));
    }
    if (now.length > 0) add(now);
    return () => handles.forEach((h) => clearTimeout(h));
    // the schedule, not the array identity: a game builds a fresh array every render
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    reduced,
    flights,
    start,
    landed: (id) => done.has(id),
    count: (pick) => flights.filter((f) => pick(f) && done.has(f.id)).length,
    slot: (id) => ({
      'data-tally-key': id,
      className: done.has(id) ? styles.land! : styles.wait!,
    }),
  };
}

/** A number that ticks: it pops every time `value` changes (a card's votes as each face lands).
 *  Children replace the bare number ("3 votes"); `className` styles the pill around it. */
export function TallyCount({
  value,
  className,
  children,
}: {
  value: number;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  const tick = value > 0 ? styles.tick : undefined;
  return (
    <span key={value} className={[className, tick].filter(Boolean).join(' ') || undefined}>
      {children ?? value}
    </span>
  );
}

const CLEAR = 60; // a face stays over its slot this long after landing, so the swap never blinks
const BACK_MS = 300;

function find(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tally-key="${key.replace(/["\\]/g, '\\$&')}"]`);
}

/** The draw-from-time layer: put it once anywhere in the stage. Draws nothing under reduced motion. */
export function TallyFlights({ tally }: { tally: Tally }): JSX.Element | null {
  const overlay = useRef<HTMLDivElement>(null);
  const sig = signature(tally.flights);
  const { reduced, start } = tally;
  useEffect(() => {
    const root = overlay.current;
    if (reduced || !root) return undefined;
    const flights = tally.flights;
    const end = Math.max(
      lastLanding(flights) + CLEAR,
      ...flights.map((f) => (f.away?.back !== undefined ? f.away.back + BACK_MS : 0)),
    );
    // The tokens, found once per schedule (no per-render ref callbacks): this effect re-runs
    // whenever the set of flights, and so the set of tokens, changes.
    const tokens = new Map<string, HTMLElement>();
    for (const el of root.querySelectorAll<HTMLElement>('[data-tally-token]'))
      tokens.set(el.dataset.tallyToken ?? '', el);
    const touched = new Set<HTMLElement>();
    const lastAway = new Map<string, string>();
    let raf = 0;
    const frame = (): void => {
      const t = performance.now() - start;
      const base = root.getBoundingClientRect();
      const k = root.offsetWidth > 0 && base.width > 0 ? base.width / root.offsetWidth : 1;
      const boxOf = (el: Element, face: boolean): Box => {
        const r = (face ? (el.querySelector('svg') ?? el) : el).getBoundingClientRect();
        return {
          cx: (r.left + r.width / 2 - base.left) / k,
          cy: (r.top + r.height / 2 - base.top) / k,
          size: r.width / k,
        };
      };
      const draws: (() => void)[] = [];
      for (const f of flights) {
        const token = tokens.get(f.id);
        const src = find(f.from);
        const dst = find(f.to);
        if (f.away && src) {
          const { opacity, back } = f.away;
          let v: string | null = null;
          if (t >= f.at) {
            const q = back === undefined ? 0 : progress(t, back, BACK_MS);
            v = String(+(opacity + (1 - opacity) * q).toFixed(3));
          }
          if (v !== null && lastAway.get(f.id) !== v) {
            lastAway.set(f.id, v);
            src.style.opacity = v === '1' ? '' : v;
            touched.add(src);
          }
        }
        if (!token) continue;
        const points = kindOf(f) === 'points';
        const dur = durOf(f);
        const shownFrom = points ? (f.pop ?? f.at) : f.at;
        const shownTo = landedAt(f) + (points ? 0 : CLEAR);
        if (!src || !dst || t < shownFrom || t >= shownTo) {
          draws.push(() => {
            token.style.opacity = '0';
          });
          continue;
        }
        const p = progress(t, f.at, dur);
        const from = boxOf(src, true);
        const to = boxOf(dst, false);
        // A face leaving something without a face of its own (a card) starts at the slot's size.
        if (!src.querySelector('svg')) from.size = to.size;
        const pose = flightPose(from, to, p, f.lift ?? 170, kindOf(f));
        const rest = points && p <= 0;
        const scale = rest ? Math.max(0.01, popIn((t - shownFrom) / 380)) : pose.scale;
        const cx = rest ? from.cx : pose.cx;
        const cy = rest ? from.cy : pose.cy;
        // Sizes are read here, before any write of this frame: a face is sized to its source (no
        // padding or border), a points pill keeps its natural size (the flight scales a transform).
        const w = points ? token.offsetWidth : from.size;
        const h = points ? token.offsetHeight : from.size;
        draws.push(() => {
          if (!points) {
            token.style.width = `${from.size}px`;
            token.style.height = `${from.size}px`;
          }
          token.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${rest ? 0 : pose.rot}deg) scale(${scale})`;
          token.style.opacity = rest ? '1' : String(+flightOpacity(p, f.sheer).toFixed(3));
        });
      }
      for (const d of draws) d();
      if (t < end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      for (const el of touched) el.style.opacity = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, reduced, start]);
  if (reduced) return null;
  return (
    <div ref={overlay} className={styles.overlay} aria-hidden="true">
      {tally.flights.map((f) => {
        const points = kindOf(f) === 'points';
        if (!points && !f.avatarId) return null;
        return (
          <span
            key={f.id}
            data-tally-token={f.id}
            className={`${styles.token} ${points ? styles.points : styles.face}`}
          >
            {points ? f.label : <Avatar avatarId={f.avatarId ?? ''} size="100%" />}
          </span>
        );
      })}
    </div>
  );
}
