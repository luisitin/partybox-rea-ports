// Multiple choice: 2–6 big buttons (letters + text), one tap locks the pick. Never colour-only:
// the chosen option shows ✓, correct/incorrect (after reveal) show ✓/✗ plus a hidden label.
// The tap locks the grid optimistically (✓ + "Locking in…") before the server echoes `selectedId`;
// a `promptKey` change clears that, and a 4 s silence re-enables the grid with a retry line.
import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { buzz } from '../ui/haptics';
import { useT } from '../ui/lang';
import { Screen } from './Screen';
import styles from './ChoiceGrid.module.css';
import { SDK_LINES, usePhoneOnly } from './phoneOnly';
import { STRINGS } from './strings';

export interface Choice {
  id: string;
  label: ReactNode;
}

export interface ChoiceGridProps {
  prompt?: ReactNode;
  kicker?: string;
  choices: Choice[];
  /** The player's locked pick, if any. */
  selectedId?: string | null;
  /** After reveal: which id was correct (marks the grid). */
  correctId?: string | null;
  disabled?: boolean;
  onPick: (id: string) => void;
  footer?: ReactNode;
  /**
   * Identifies the prompt (e.g. `${phaseId}:${round}`) so the optimistic lock resets when a new
   * prompt arrives — never keyed on `choices`, which callers rebuild every render.
   */
  promptKey?: string;
  /** Stretch the choices to fill the screen body — for speed games where reach and target size matter. */
  fill?: boolean;
  /** `false` drops the A/B/C discs (a wager menu is not a quiz). Default true. */
  letters?: boolean;
  /** `final` paints the kicker in the accent colour, like the TV's "final question" kicker. */
  tone?: 'default' | 'final';
  /** Replaces "✓ Locked in — look at the TV" once the server has echoed the pick (e.g. with the time to spare). */
  lockedHint?: ReactNode;
  /** I-026 B: a class for the screen (a game styles a state of the grid, e.g. a placed wager). */
  className?: string;
  /** Rendered in the scrolling body under the grid (a "phone only" room's results list — S-005). */
  after?: ReactNode;
  /** I-790 C: a band under the prompt, over the answers (Lightning's reveal verdict). */
  band?: ReactNode;
}

const LETTERS = 'ABCDEFGH';
/** I-789 B: an answer this short fits half a phone's width. */
const SHORT_ANSWER = 12;
/** How long an unacknowledged tap stays locked before the grid offers a retry. */
const ECHO_TIMEOUT_MS = 4000;

interface Pending {
  key: string | undefined;
  id: string;
  /** The server never echoed the pick: the grid is enabled again and says so. */
  failed: boolean;
}

export function ChoiceGrid(props: ChoiceGridProps): JSX.Element {
  const phoneOnly = usePhoneOnly();
  const L = useT(STRINGS);
  const {
    className,
    after,
    band,
    prompt,
    kicker,
    choices,
    selectedId = null,
    correctId = null,
    disabled,
    onPick,
    footer,
    promptKey,
    fill,
    letters = true,
    tone = 'default',
    lockedHint,
  } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  // "Adjust state when a prop changes": a new prompt clears the optimistic lock.
  if (pending !== null && pending.key !== promptKey) setPending(null);
  const pendingId = pending !== null && !pending.failed ? pending.id : null;
  const echoed = selectedId !== null;
  useEffect(() => {
    if (pendingId === null || echoed) return;
    const handle = setTimeout(
      () => setPending((p) => (p !== null && p.id === pendingId ? { ...p, failed: true } : p)),
      ECHO_TIMEOUT_MS,
    );
    return () => clearTimeout(handle);
  }, [pendingId, echoed]);
  const shownId = selectedId ?? pendingId;
  const locked = shownId !== null || disabled;
  // I-789 B: four short answers sit two by two (sideways every fill grid does, in CSS)
  const shortAnswers =
    choices.length === 4 &&
    choices.every((c) => typeof c.label === 'string' && c.label.length <= SHORT_ANSWER);
  const pick = (id: string): void => {
    buzz(15);
    setPending({ key: promptKey, id, failed: false });
    onPick(id);
  };
  return (
    <Screen footer={footer} className={className}>
      {/* I-789 B: a fill grid is question over answers — sideways, question beside a 2×2 */}
      <div className={fill ? styles.layout : styles.plain}>
        <div className={fill ? styles.head : styles.plain}>
          {kicker ? (
            <p className={`${styles.kicker} ${tone === 'final' ? styles.kickerFinal : ''}`}>
              {kicker}
            </p>
          ) : null}
          {prompt ? <p className={styles.prompt}>{prompt}</p> : null}
          {band}
        </div>
        <div
          className={`${styles.grid} ${fill ? styles.fill : ''} ${fill && shortAnswers ? styles.two : ''}`}
          role="radiogroup"
          aria-label={L('choices')}
        >
          {choices.map((choice, index) => {
            const isSelected = choice.id === shownId;
            const revealed = correctId !== null;
            const isCorrect = revealed && choice.id === correctId;
            const isWrongPick = revealed && isSelected && !isCorrect;
            const classes = [
              styles.choice,
              letters ? '' : styles.noLetters,
              isSelected ? styles.selected : '',
              isCorrect ? styles.correct : '',
              isWrongPick ? styles.wrong : '',
              locked && !isSelected && !isCorrect ? styles.dim : '',
            ].join(' ');
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={classes}
                disabled={locked}
                onClick={() => pick(choice.id)}
              >
                {letters ? (
                  <span className={styles.letter} aria-hidden>
                    {LETTERS[index] ?? index + 1}
                  </span>
                ) : null}
                <span className={styles.label}>{choice.label}</span>
                <span className={styles.mark} aria-hidden>
                  {isCorrect || isWrongPick ? (
                    // I-790 C: the verdict is on the tiles — "✓ the answer", "you" (a two-by-two
                    // tile keeps the glyph only)
                    <>
                      <span className={isWrongPick ? styles.glyphTight : undefined}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                      <span className={styles.tag}>{isSelected ? L('you') : L('the answer')}</span>
                    </>
                  ) : isSelected ? (
                    '✓'
                  ) : (
                    ''
                  )}
                </span>
                {isCorrect ? <span className="pb-visually-hidden">{L('correct')}</span> : null}
                {isWrongPick ? <span className="pb-visually-hidden">{L('incorrect')}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {after}
      {/* I-789 B: a fill grid holds the status line's space before the tap, so locking in moves
          nothing (the rows shrank or drifted under the finger when it appeared) */}
      {fill && correctId === null && shownId === null && !pending?.failed ? (
        <p className={`${styles.locked} ${styles.reserved}`} aria-hidden>
          {' '}
        </p>
      ) : null}
      {correctId === null ? (
        selectedId !== null ? (
          <p className={styles.locked} role="status">
            {lockedHint ?? SDK_LINES.lockedIn(phoneOnly, L)}
          </p>
        ) : pendingId !== null ? (
          <p className={styles.locked} role="status">
            {L('✓ Locking in…')}
          </p>
        ) : pending?.failed ? (
          <p className={`${styles.locked} ${styles.failed}`} role="status">
            {SDK_LINES.retry(phoneOnly, L)}
          </p>
        ) : null
      ) : null}
    </Screen>
  );
}
