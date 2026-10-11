// A thin bar that drains towards the deadline (the TV strip and the phone header). Transform-only so it stays
// cheap. It turns danger-coloured in the last 5 seconds, but only in a phase of at least URGENCY_MIN_MS: a 6 s
// bingo call went red half the time, 75 times a round, and made red meaningless (review-loop #1).
// The view names the phase instance (phaseKey and phaseAt, ADR-097). The bar starts its countdown when it first
// sees that instance (phaseSeen.ts), so a late joiner sees the bar start full from then. A VIP resume moves the
// deadline but not the instance: the start moves with it, so the fill holds where the pause left it (T-0701 F1).
// A skip into a same-id phase is a new instance and starts fresh (F4). While paused the bar reads the clockHeldAt
// of the view (ADR-096) and holds still. A new instance remounts the track, so a new phase mounts a fresh full
// bar instead of tweening the old fill back to full width (R-069).
import { useState } from 'react';
import type { JSX } from 'react';
import { useServerNow } from './clock';
import styles from './DeadlineBar.module.css';
import { nextSeen, startSeen } from './phaseSeen';

/** Shorter phases (a call, a beat) just drain: no danger colour, no urgency to cry wolf with. */
export const URGENCY_MIN_MS = 15_000;

export interface DeadlineBarProps {
  deadline: number | null;
  /** Changes whenever a new phase instance starts (e.g. `phaseId`). */
  phaseKey: string;
  /** The phaseAt of the view: with phaseKey it names the instance, so a same-id skip is a new one. */
  phaseAt: number;
  paused?: boolean;
  /** The clockHeldAt of the view: while paused, the bar holds at that server time (ADR-096). */
  clockHeldAt?: number;
  /** Seconds left at which the bar switches to the danger colour (default 5). */
  urgentAt?: number;
  className?: string;
}

export function DeadlineBar({
  deadline,
  phaseKey,
  phaseAt,
  paused = false,
  clockHeldAt,
  urgentAt = 5,
  className,
}: DeadlineBarProps): JSX.Element | null {
  const now = useServerNow(paused ? 60_000 : 250, paused, clockHeldAt);
  // "Adjust state when a prop changes": the phase instance this bar is showing.
  const [seen, setSeen] = useState(() => startSeen(phaseKey, phaseAt, deadline, paused, now));
  const phase = nextSeen(seen, phaseKey, phaseAt, deadline, paused, now);
  if (phase !== seen) setSeen(phase);
  if (deadline === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const total = Math.max(1, deadline - phase.at);
  const fraction = Math.min(1, Math.max(0, (deadline - now) / total));
  const urgent = !paused && seconds <= urgentAt && seconds > 0 && total >= URGENCY_MIN_MS;
  return (
    <div
      key={phase.gen}
      className={`${styles.track} ${urgent ? styles.urgent : ''} ${paused ? styles.paused : ''} ${className ?? ''}`}
      aria-hidden
    >
      <div className={styles.fill} style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}
