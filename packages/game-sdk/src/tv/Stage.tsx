// The overscan-safe frame for everything on the TV: 5 % padding, column layout, one focal point.
import type { JSX, ReactNode } from 'react';
import styles from './Stage.module.css';

export interface StageProps {
  children: ReactNode;
  /** Vertically centre the content (title cards, reveals). */
  center?: boolean;
  className?: string;
}

export function Stage({ children, center, className }: StageProps): JSX.Element {
  return (
    <div className={`${styles.stage} ${center ? styles.center : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}
