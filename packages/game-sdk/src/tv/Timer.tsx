// The stage timer: huge digits, turns red and scales in the last 5 seconds, ticks via `onTick`
// (the TV shell maps that to the `countdown` sound cue). Shows a pause glyph while paused.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useServerNow } from '../ui/clock';
import { useT } from '../ui/lang';
import { nextSeen, startSeen } from '../ui/phaseSeen';
import styles from './Timer.module.css';
import { STRINGS } from './strings';

export interface TimerProps {
  deadline: number | null;
  /** Changes whenever a new phase instance starts (e.g. `phaseId`), as for DeadlineBar. */
  phaseKey: string;
  /** The phaseAt of the view (ADR-097): with phaseKey it names the phase instance. */
  phaseAt: number;
  paused?: boolean;
  /** The clockHeldAt of the view (ADR-096): the digits hold there while paused. */
  clockHeldAt?: number;
  /** Fires once per second during the last 5 seconds. */
  onTick?: (secondsLeft: number) => void;
  size?: 'md' | 'lg';
}

export function Timer({
  deadline,
  phaseKey,
  phaseAt,
  paused = false,
  clockHeldAt,
  onTick,
  size = 'lg',
}: TimerProps): JSX.Element | null {
  const L = useT(STRINGS);
  const now = useServerNow(paused ? 60_000 : 250, paused, clockHeldAt);
  // "Adjust state when a prop changes": the phase instance this timer shows. Short phases (a 5 s reveal, ten
  // times a game) never go red: urgency is for phases of 15 s or more, judged by how much was left when the
  // instance was first seen (review-loop #24, as DeadlineBar). A VIP resume moves the deadline and the start
  // together, so it keeps the phase length and the urgency (T-0701 F1).
  const [seen, setSeen] = useState(() => startSeen(phaseKey, phaseAt, deadline, paused, now));
  const phase = nextSeen(seen, phaseKey, phaseAt, deadline, paused, now);
  if (phase !== seen) setSeen(phase);
  const seconds = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  const longPhase = phase.deadline !== null && Math.ceil((phase.deadline - phase.at) / 1000) >= 15;
  const lastTicked = useRef<number | null>(null);
  useEffect(() => {
    if (seconds === null || paused || seconds > 5 || seconds === 0 || !longPhase) return;
    if (lastTicked.current === seconds) return;
    lastTicked.current = seconds;
    onTick?.(seconds);
  }, [seconds, paused, onTick, longPhase]);
  if (seconds === null) return null;
  const urgent = !paused && seconds <= 5 && longPhase;
  return (
    <div
      className={`${styles.timer} ${styles[size]} ${urgent ? styles.urgent : ''} ${paused ? styles.paused : ''}`}
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={paused ? L('paused') : L('{n} seconds left', { n: seconds })}
    >
      {paused ? <span className={styles.pauseGlyph}>&#x23F8;</span> : null}
      <span className={styles.digits}>{seconds}</span>
      {urgent ? <span className={styles.hurry}>{L('Hurry!')}</span> : null}
    </div>
  );
}
