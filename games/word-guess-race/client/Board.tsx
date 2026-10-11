// Personal feedback keeps letters; public feedback uses symbols only.
import type { JSX } from 'react';
import type { Guess } from '../server/types';
import { MARK_LABEL, MARK_SYMBOL } from './tiles';
import styles from './Controller.module.css';

export function Board({ guesses, draft = '' }: { guesses: Guess[]; draft?: string }): JSX.Element {
  const summary = guesses
    .map(
      (guess, row) =>
        `Guess ${row + 1}, ${guess.word.toUpperCase()}: ${guess.word
          .split('')
          .map((letter, col) => `${letter.toUpperCase()} ${MARK_LABEL[guess.marks[col]!]}`)
          .join(', ')}`,
    )
    .join('. ');
  return (
    <div
      className={styles.board}
      role="img"
      aria-label={`Your six guesses. ${summary || 'No guesses yet.'}${draft ? ` Current word: ${draft.toUpperCase()}.` : ''}`}
    >
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const guess = guesses[row];
          const mark = guess?.marks[col];
          const letter = guess?.word[col] ?? (row === guesses.length ? draft[col] : '') ?? '';
          return (
            <span
              key={`${row}-${col}`}
              className={styles.tile}
              data-mark={mark}
              data-draft={!mark && Boolean(letter)}
              aria-label={`Row ${row + 1}, ${letter ? letter.toUpperCase() : 'empty'}${mark ? `: ${MARK_LABEL[mark]}` : ''}`}
            >
              <b>{letter.toUpperCase()}</b>
              {mark ? <small aria-hidden="true">{MARK_SYMBOL[mark]}</small> : null}
            </span>
          );
        }),
      )}
    </div>
  );
}
