// The sheen that crosses a held title or result (T-0946): a slow band of light, so the TV never sits
// still on a card. Its own clipped layer, so the card's content never clips or widens; decorative
// and silent for screen readers.
import type { JSX } from 'react';
import styles from './MinigameFrame.module.css';

export function Sheen(): JSX.Element {
  return (
    <span className={styles.sheen} aria-hidden>
      <span className={styles.sheenBand} />
    </span>
  );
}
