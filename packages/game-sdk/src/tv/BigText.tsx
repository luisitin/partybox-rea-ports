// Display-size text for the one thing the room should read right now (a prompt, a question, a winner).
import type { JSX, ReactNode } from 'react';
import styles from './BigText.module.css';

export interface BigTextProps {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'muted';
  /** `display` = 128 px, `h1` = 72 px, `h2` = 48 px at 1080p. */
  level?: 'display' | 'h1' | 'h2';
  className?: string;
}

export function BigText({
  children,
  tone = 'default',
  level = 'h1',
  className,
}: BigTextProps): JSX.Element {
  return (
    <p className={`${styles.big} ${styles[level]} ${styles[tone]} ${className ?? ''}`}>
      {children}
    </p>
  );
}
