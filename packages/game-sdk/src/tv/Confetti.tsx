// Celebration confetti for the TV: pieces in the theme's four accents fall across the whole screen
// for as long as it is mounted (a winner reveal, the results ceremony), or just once (`once`: a
// burst for a beat whose results stay up). Spread and timing are derived from the index, so a
// re-render never reshuffles. Nothing renders under reduced motion.
import { useMemo } from 'react';
import type { CSSProperties, JSX } from 'react';
import { usePrefersReducedMotion } from '../ui/motion';
import styles from './Confetti.module.css';

export interface ConfettiProps {
  /** How many pieces are in the air at once. */
  pieces?: number;
  /** One fall (about 2 s, staggered), then the screen is clear: nothing rests over what the beat
   *  shows next. Without it the fall loops for as long as it is mounted. */
  once?: boolean;
}

const TONES = [styles.c0, styles.c1, styles.c2, styles.c3];

export function Confetti({ pieces = 72, once = false }: ConfettiProps): JSX.Element | null {
  const reduced = usePrefersReducedMotion();
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        // Golden-angle spacing spreads pieces evenly without clumping; the other values just
        // need to look unrelated to each other.
        const left = (i * 61.8) % 100;
        const spread = ((i * 37) % 100) / 100;
        // A loop starts mid-fall (negative: the first frame is already full); a single fall
        // starts above the screen and staggers its pieces over 0.8 s.
        const delay = once ? spread * 0.8 : -spread * 3;
        const drift = (((i * 53) % 21) - 10) * 12; // −120 … +120 px sideways over the fall
        const spin = ((i * 29) % 2 ? 1 : -1) * (540 + ((i * 17) % 360));
        const scale = 0.7 + ((i * 13) % 7) / 10;
        const style = {
          left: `${left}%`,
          animationDelay: `${delay}s`,
          '--pb-confetti-drift': `${drift}px`,
          '--pb-confetti-spin': `${spin}deg`,
          '--pb-confetti-scale': String(scale),
        } as CSSProperties;
        return { key: i, tone: TONES[i % TONES.length] ?? '', style };
      }),
    [pieces, once],
  );
  if (reduced) return null;
  return (
    <div className={styles.confetti} data-once={once || undefined} aria-hidden>
      {items.map((p) => (
        <span key={p.key} className={`${styles.piece} ${p.tone}`} style={p.style} />
      ))}
    </div>
  );
}
