// T-0602 / ADR-090: the button prompt ("○ Roll"). Shows only while a pad is connected, in the pad's
// own shapes (PlayStation glyphs on a DualSense), so a touch player never sees it.
import type { JSX } from 'react';
import { glyph } from './core';
import type { PadButton } from './core';
import { usePad } from './PadProvider';
import styles from './PadGlyph.module.css';

export interface PadGlyphProps {
  button: PadButton;
  className?: string;
}

export function PadGlyph({ button, className }: PadGlyphProps): JSX.Element | null {
  const { connected, kind } = usePad();
  if (!connected) return null;
  return (
    <span className={`${styles.glyph} ${className ?? ''}`} data-pad-glyph={button} aria-hidden>
      {glyph(button, kind)}
    </span>
  );
}
