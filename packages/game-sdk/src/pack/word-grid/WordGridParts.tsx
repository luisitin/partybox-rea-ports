// The pieces on top of a WordGrid card: the pointer faces and a floating reaction.
import { useState } from 'react';
import type { JSX } from 'react';
import { Avatar } from '../../ui/Avatar';
import { useServerNow } from '../../ui/clock';
import styles from './WordGrid.module.css';

export interface GridFace {
  id: string;
  avatarId: string;
}

export function Faces({ faces }: { faces: readonly GridFace[] }): JSX.Element | null {
  if (faces.length === 0) return null;
  const shown = faces.slice(0, 4);
  const more = faces.length - shown.length;
  return (
    <span className={styles.faces}>
      {shown.map((f) => (
        <span key={f.id} className={styles.face}>
          <Avatar avatarId={f.avatarId} size="100%" />
        </span>
      ))}
      {more > 0 ? <span className={styles.more}>+{more}</span> : null}
    </span>
  );
}

/** A reaction floating over a card; its age is read once, so re-renders never restart it. */
export function Reaction({ emoji, until }: { emoji: string; until: number }): JSX.Element | null {
  const now = useServerNow(60_000);
  const [delay] = useState(-Math.max(0, now - (until - 5000)));
  if (delay <= -5000) return null;
  return (
    <span className={styles.reaction} style={{ animationDelay: `${delay}ms` }}>
      {emoji}
    </span>
  );
}
