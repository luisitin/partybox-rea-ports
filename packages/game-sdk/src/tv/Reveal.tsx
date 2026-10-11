// Sequential reveal of items on the TV (answers with authors and votes, correct answers…). Items
// appear one by one every `stepMs`; emphasised items get the accent outline. Pure presentation.
import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { usePrefersReducedMotion } from '../ui/motion';
import styles from './Reveal.module.css';

export interface RevealItem {
  id: string;
  text: ReactNode;
  /** Small line under the text (author, points). */
  detail?: ReactNode;
  /** Chip-like content on the right (e.g. voter avatars). */
  aside?: ReactNode;
  emphasis?: boolean;
}

export interface RevealProps {
  items: RevealItem[];
  /** ms between items; 0 shows everything at once (screenshots, reduced motion). */
  stepMs?: number;
  onDone?: () => void;
}

export function Reveal({ items, stepMs: requestedStepMs = 700, onDone }: RevealProps): JSX.Element {
  // Reduced motion: no one-by-one sequence, everything at once.
  const stepMs = usePrefersReducedMotion() ? 0 : requestedStepMs;
  const [shown, setShown] = useState(stepMs === 0 ? items.length : 0);
  useEffect(() => {
    if (shown >= items.length) {
      onDone?.();
      return;
    }
    if (stepMs === 0) {
      const all = setTimeout(() => setShown(items.length), 0);
      return () => clearTimeout(all);
    }
    const handle = setTimeout(() => setShown((n) => n + 1), stepMs);
    return () => clearTimeout(handle);
  }, [shown, items.length, stepMs, onDone]);
  return (
    <ol className={styles.list} aria-live="polite">
      {items.slice(0, shown).map((item) => (
        <li key={item.id} className={`${styles.item} ${item.emphasis ? styles.emphasis : ''}`}>
          <div className={styles.main}>
            <span className={styles.text}>{item.text}</span>
            {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
          </div>
          {item.aside ? <div className={styles.aside}>{item.aside}</div> : null}
        </li>
      ))}
    </ol>
  );
}
