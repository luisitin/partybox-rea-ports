// CardFace: a card's printed side, sized by its frame (container units), so one face reads the same
// in the hand, on a pile and on the TV. The corner index stays in the sliver a fanned card shows.
import type { CSSProperties, JSX } from 'react';
import type { CardFaceProps } from './types';
import styles from './CardHand.module.css';

export function CardFace({ index, centre, ink, look = 'paper', mark }: CardFaceProps): JSX.Element {
  return (
    <span
      className={styles.face}
      data-look={look}
      style={{ '--ink': ink } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.index}>
        {index}
        {mark ? <span className={styles.mark}>{mark}</span> : null}
      </span>
      <span className={styles.centre}>{centre ?? index}</span>
      <span className={`${styles.index} ${styles.flip}`}>{index}</span>
    </span>
  );
}
