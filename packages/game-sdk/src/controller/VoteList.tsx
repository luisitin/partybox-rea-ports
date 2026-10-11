// Vote between candidate answers. One tap locks the vote; the player's own entry (if any) is shown
// but not votable. Works for 2..N options; long text wraps. `size="large"` (two or three options)
// fills the thumb zone with h2 text and a lettered disc so the party's key decision is not a row of
// 18 px lines above an empty screen. The tap locks the list optimistically (✓ + "Locking in…")
// before the server echoes `votedId`; a `promptKey` change clears that, and a 4 s silence
// re-enables the list with a retry line.
import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { buzz } from '../ui/haptics';
import { useT } from '../ui/lang';
import { Screen } from './Screen';
import styles from './VoteList.module.css';
import { SDK_LINES, usePhoneOnly } from './phoneOnly';
import { STRINGS } from './strings';

export interface VoteOption {
  id: string;
  text: ReactNode;
  /** This option belongs to the voter → rendered disabled with a "yours" tag. */
  mine?: boolean;
  /** Placeholder content (e.g. "(no answer)") → italic and muted, still votable. */
  muted?: boolean;
}

export interface VoteListProps {
  prompt?: ReactNode;
  /** Block content above the prompt — what the room is voting ON (Blanks' black card). Rendered
   *  in its own element, so a card or an image is valid markup (the prompt is a paragraph). */
  header?: ReactNode;
  kicker?: string;
  options: VoteOption[];
  votedId?: string | null;
  disabled?: boolean;
  onVote: (id: string) => void;
  footer?: ReactNode;
  /** `large` for 2–3 options: tall lettered cards instead of compact rows. */
  size?: 'compact' | 'large';
  /**
   * Identifies the vote (e.g. the prompt id) so the optimistic lock resets when a new vote
   * arrives — never keyed on `options`, which callers rebuild every render.
   */
  promptKey?: string;
  /** What the phone says once the vote is echoed (default "✓ Vote in — look at the TV"); a game
   *  that plays without a TV, or whose result comes to the phone, says so instead. `null` hides
   *  the line (the caller carries the confirmation in its footer, where a long list cannot push
   *  it under the sticky bar — review-loop #138). */
  lockedLabel?: ReactNode;
}

const LETTERS = 'ABCDEFGH';
/** How long an unacknowledged tap stays locked before the list offers a retry. */
const ECHO_TIMEOUT_MS = 4000;

interface Pending {
  key: string | undefined;
  id: string;
  failed: boolean;
}

export function VoteList(props: VoteListProps): JSX.Element {
  const phoneOnly = usePhoneOnly();
  const L = useT(STRINGS);
  const {
    prompt,
    header,
    kicker,
    options,
    votedId = null,
    disabled,
    onVote,
    footer,
    size = 'compact',
    promptKey,
    lockedLabel,
  } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  // "Adjust state when a prop changes": a new vote clears the optimistic lock.
  if (pending !== null && pending.key !== promptKey) setPending(null);
  const pendingId = pending !== null && !pending.failed ? pending.id : null;
  const echoed = votedId !== null;
  useEffect(() => {
    if (pendingId === null || echoed) return;
    const handle = setTimeout(
      () => setPending((p) => (p !== null && p.id === pendingId ? { ...p, failed: true } : p)),
      ECHO_TIMEOUT_MS,
    );
    return () => clearTimeout(handle);
  }, [pendingId, echoed]);
  const shownId = votedId ?? pendingId;
  const locked = shownId !== null || disabled;
  const large = size === 'large';
  const vote = (id: string): void => {
    buzz(15);
    setPending({ key: promptKey, id, failed: false });
    onVote(id);
  };
  return (
    <Screen footer={footer}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      {header ? <div className={styles.header}>{header}</div> : null}
      {prompt ? <p className={styles.prompt}>{prompt}</p> : null}
      <div
        className={`${styles.list} ${large ? styles.large : ''}`}
        role="radiogroup"
        aria-label={L('vote')}
      >
        {options.map((option, index) => {
          const isVoted = option.id === shownId;
          const classes = [
            styles.option,
            isVoted ? styles.voted : '',
            option.mine ? styles.mine : '',
            option.muted ? styles.muted : '',
            locked && !isVoted ? styles.dim : '',
          ].join(' ');
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isVoted}
              className={classes}
              disabled={locked || option.mine}
              onClick={() => vote(option.id)}
            >
              {large ? (
                <span className={styles.letter} aria-hidden>
                  {LETTERS[index] ?? index + 1}
                </span>
              ) : null}
              <span className={styles.text}>{option.text}</span>
              {option.mine ? <span className={styles.tag}>{L('yours')}</span> : null}
              {isVoted ? (
                <span className={styles.mark} aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {votedId !== null ? (
        lockedLabel === null ? null : (
          <p className={styles.locked} role="status">
            {lockedLabel ?? SDK_LINES.voteIn(phoneOnly, L)}
          </p>
        )
      ) : pendingId !== null ? (
        <p className={styles.locked} role="status">
          {L('✓ Locking in…')}
        </p>
      ) : pending?.failed ? (
        <p className={`${styles.locked} ${styles.failed}`} role="status">
          {SDK_LINES.retry(phoneOnly, L)}
        </p>
      ) : null}
    </Screen>
  );
}
