// CardHand's slim bar: how many cards you hold, and one button per sort ("1 2 3", "Colour", a
// game's own). The lit button is the sort in force; moving a card by hand turns it off.
import type { JSX } from 'react';
import { useT } from '../../ui/lang';
import { STRINGS } from './strings';
import type { HandSort } from './types';
import styles from './CardHand.module.css';

export const sortId = (sort: HandSort): string => (typeof sort === 'string' ? sort : sort.id);

interface SortBarProps {
  count: number;
  sorts: readonly HandSort[];
  active: string | null;
  onSort: (sort: HandSort) => void;
}

export function SortBar({ count, sorts, active, onSort }: SortBarProps): JSX.Element {
  const L = useT(STRINGS);
  const text = count === 1 ? L('1 card') : L('{n} cards', { n: count });
  return (
    <div className={styles.bar}>
      {/* Word by word, so a word that does not fit drops whole ("11", never "11 cart…"). */}
      <span className={styles.count}>
        <span className={styles.said}>{text}</span>
        {text.split(' ').map((word, i) => (
          <span key={i} aria-hidden="true">
            {word}
          </span>
        ))}
      </span>
      <span className={styles.sorts} role="group" aria-label={L('Sort')}>
        {sorts.map((sort) => (
          <button
            key={sortId(sort)}
            type="button"
            className={styles.sort}
            aria-pressed={active === sortId(sort)}
            aria-label={
              sort === 'rank'
                ? L('Sort by number')
                : sort === 'suit'
                  ? L('Sort by colour')
                  : sort === 'sets'
                    ? L('Put equal numbers together')
                    : sort.label
            }
            onClick={() => onSort(sort)}
          >
            {sort === 'rank' ? (
              <span aria-hidden="true">1 2 3</span>
            ) : sort === 'suit' ? (
              <>
                <span className={styles.dots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span aria-hidden="true">{L('Colour')}</span>
              </>
            ) : sort === 'sets' ? (
              <span aria-hidden="true">{L('Sets')}</span>
            ) : (
              <>
                {sort.icon ? <span aria-hidden="true">{sort.icon}</span> : null}
                <span aria-hidden="true">{sort.label}</span>
              </>
            )}
          </button>
        ))}
      </span>
    </div>
  );
}
