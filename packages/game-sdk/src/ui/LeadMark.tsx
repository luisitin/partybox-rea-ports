// I-268: the one mark for "in the lead right now" — the word, not a glyph. 🏆 stays "won", 👑 stays
// the VIP handover. The caller sets the size and colour (the tag's ring is the text's colour).
import type { JSX } from 'react';
import { STRINGS } from '../controller/strings';
import { useT } from './lang';
import styles from './LeadMark.module.css';

export function LeadMark({ className }: { className?: string }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <span className={`${styles.lead} ${className ?? ''}`} role="img" aria-label={L('leading')}>
      {L('1st')}
    </span>
  );
}
