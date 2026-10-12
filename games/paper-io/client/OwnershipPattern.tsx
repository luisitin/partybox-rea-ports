import type { JSX } from 'react';
import { ownershipTexture } from './textures';
import styles from './OwnershipPattern.module.css';

export function OwnershipPattern({ id, slot }: { id: string; slot: number }): JSX.Element {
  const texture = ownershipTexture(slot);
  return (
    <pattern id={id} width="2" height="2" patternUnits="userSpaceOnUse" data-texture={texture.name}>
      {texture.dots ? (
        <circle cx="1" cy="1" r="0.14" className={styles.dot} />
      ) : (
        <path d={texture.path} className={styles.line} />
      )}
    </pattern>
  );
}
