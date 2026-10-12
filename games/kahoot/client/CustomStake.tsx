// I-026 (the owner: "a custom percentage or points amount as an additional option"): the fifth
// wager row, under the presets in the grid's footer — a number, a % / pts switch and Place. A
// percentage becomes points by the presets' own rule (`wagerAmount`); points go as they are; the
// server clamps either (0…score, tens) and is the source of truth. Bots keep the presets.
import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { wagerAmount } from '../server/wager'; // I-752 A: not scoring.ts (it imports the questions)
import { Chips } from './ControllerBits';
import styles from './Controller.module.css';
import { STRINGS } from './strings';

export interface CustomStakeProps {
  score: number;
  /** The custom amount the server holds; null while still unconfirmed. */
  placed: number | null;
  pending?: boolean;
  failed?: boolean;
  /** A preset was taken: the row steps back and takes no input. */
  disabled: boolean;
  onPlace: (amount: number) => void;
}

/** What the field works out to in points, or null while it is not a stake yet. */
function stakeOf(text: string, unit: 'pct' | 'pts', score: number): number | null {
  if (!/^\d{1,7}$/.test(text)) return null;
  const n = Number(text);
  if (unit === 'pct') return n >= 1 && n <= 100 ? wagerAmount(score, n) : null;
  return n <= score ? Math.min(score, Math.floor(n / 10) * 10) : null;
}

export function CustomStake({
  score,
  placed,
  disabled,
  pending,
  failed,
  onPlace,
}: CustomStakeProps): JSX.Element {
  const L = useT(STRINGS);
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<'pct' | 'pts'>('pct');
  const amount = placed ?? stakeOf(text, unit, score);
  const percent = amount === null || score <= 0 ? 0 : (amount / score) * 100;
  const open = placed === null && !disabled;
  return (
    <div
      className={`${styles.custom} ${placed !== null ? styles.customOn : ''} ${disabled ? styles.customOff : ''} ${open ? styles.customOpen : ''}`}
      role="group"
      aria-label={L('custom wager')}
    >
      {open ? (
        // I-550 (the owner's note): open, the row is one line — what it works out to over "Custom"
        <span className={styles.customLead}>
          {amount !== null ? <span className={styles.amount}>{amount}</span> : null}
          <span className={styles.pct}>{L('Custom')}</span>
        </span>
      ) : (
        <span className={styles.wagerRow}>
          <Chips percent={percent} />
          <span className={styles.amount}>{amount ?? '–'}</span>
          <span className={styles.pct}>{placed !== null ? L('✓ your stake') : L('Custom')}</span>
        </span>
      )}
      {open ? (
        <form
          className={styles.customForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (amount !== null && !pending) onPlace(amount);
          }}
        >
          <input
            className={styles.customInput}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={7}
            placeholder={unit === 'pct' ? '1–100' : `0–${score}`}
            aria-label={unit === 'pct' ? L('percentage of your score') : L('points')}
            value={text}
            disabled={pending}
            onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="button"
            disabled={pending}
            className={styles.unit}
            aria-pressed={unit === 'pts'}
            aria-label={
              unit === 'pct' ? L('percent — switch to points') : L('points — switch to percent')
            }
            onClick={() => setUnit(unit === 'pct' ? 'pts' : 'pct')}
          >
            {unit === 'pct' ? '%' : L('pts')}
          </button>
          <button type="submit" className={styles.place} disabled={amount === null || pending}>
            {pending ? L('Locking in…') : L('Place')}
          </button>
        </form>
      ) : null}
      {failed && open ? (
        <span role="status">{L('Not confirmed — place your wager again.')}</span>
      ) : null}
    </div>
  );
}
