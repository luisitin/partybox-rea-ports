import { useId } from 'react';
import type { JSX } from 'react';
import { OwnershipPattern } from './OwnershipPattern';
import styles from './SeatBadge.module.css';

export function SeatBadge({
  slot,
  className,
}: {
  slot: number;
  className?: string | undefined;
}): JSX.Element {
  const textureId = useId();
  return (
    <span className={[className, styles.badge].filter(Boolean).join(' ')}>
      <svg className={styles.texture} viewBox="0 0 4 4" aria-hidden="true">
        <defs>
          <OwnershipPattern id={textureId} slot={slot} />
        </defs>
        <rect width="4" height="4" fill={`url(#${textureId})`} />
      </svg>
      <b className={styles.number}>{slot + 1}</b>
    </span>
  );
}
