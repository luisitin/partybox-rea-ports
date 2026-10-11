// Cards that really travel between two places on the TV (hand to discard, deck to hand). The game
// finds the moves by comparing views and calls fly(); the layer is put once inside the stage.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { usePrefersReducedMotion } from '../ui/motion';
import styles from './flights.module.css';

/** A place on the stage as [x, y] in percent of its box. */
export type FlightPoint = readonly [number, number];
export interface Flight {
  id: number;
  from: FlightPoint;
  to: FlightPoint;
  delay: number;
  node: ReactNode;
}

/**
 * `fly(from, to, node, delay?)` sends `node` (a card face or back) across the stage; it is gone
 * once it lands. `layer` goes inside the stage's positioned box. Reduced motion draws nothing.
 */
export function useFlights(ms = 650): {
  fly: (from: FlightPoint, to: FlightPoint, node: ReactNode, delay?: number) => void;
  layer: JSX.Element;
  ms: number;
} {
  const reduced = usePrefersReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const live = timers.current;
    return () => live.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const fly = useCallback(
    (from: FlightPoint, to: FlightPoint, node: ReactNode, delay = 0): void => {
      if (reduced) return;
      const id = ++counter.current;
      setFlights((list) => [...list, { id, from, to, delay, node }]);
      const timer = window.setTimeout(
        () => {
          timers.current.delete(timer);
          setFlights((list) => list.filter((f) => f.id !== id));
        },
        delay + ms + 100,
      );
      timers.current.add(timer);
    },
    [reduced, ms],
  );
  const layer = (
    <>
      {flights.map((f) => (
        <span
          key={`fly-${f.id}`}
          className={styles.flight}
          aria-hidden="true"
          style={
            {
              '--x0': `${f.from[0]}%`,
              '--y0': `${f.from[1]}%`,
              '--x1': `${f.to[0]}%`,
              '--y1': `${f.to[1]}%`,
              '--ms': `${ms}ms`,
              '--delay': `${f.delay}ms`,
            } as CSSProperties
          }
        >
          <span className={styles.card}>{f.node}</span>
        </span>
      ))}
    </>
  );
  return { fly, layer, ms };
}
