// Small presentational pieces for the phone: the reveal band (I-790 C), the live worth of a right
// answer (I-288 B) and wager button labels.
import type { JSX } from 'react';
import { Avatar, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { Translator } from '@partybox/game-sdk/ui';
import type { WagerOption } from '../server/scoring';
import type { LightningControllerView, RevealRow } from '../server/views';
import styles from './Controller.module.css';
import { STRINGS } from './strings';

// The amount is the decision, so it leads at h1; the share is the caption. Plain digits, no
// thousands separator (matches every other number in the game).
export function wagerLabel(option: WagerOption, L: Translator): JSX.Element {
  const caption =
    option.percent === 0
      ? L('nothing at stake')
      : option.percent === 100
        ? L('All in') // I-550 (the owner's note): the four chips already say 100 %
        : `${option.percent} %`; // I-550 (the owner's note): the prompt already says "of your N"
  return (
    <span className={styles.wagerRow}>
      <Chips percent={option.percent} />
      <span className={styles.amount}>{option.percent === 0 ? '0' : option.amount}</span>
      <span className={styles.pct}>{caption}</span>
    </span>
  );
}

/** I-026 A: a stack of chips sized to the share — one disc per 25 %, hollow for nothing. */
export function Chips({ percent }: { percent: number }): JSX.Element {
  const chips = Math.max(1, Math.round(percent / 25));
  return (
    <span className={styles.chips} aria-hidden>
      {Array.from({ length: chips }, (_, i) => (
        <span key={i} className={`${styles.chip} ${percent === 0 ? styles.chipEmpty : ''}`} />
      ))}
    </span>
  );
}

// During the final question the TV hides wagers, so the phone is the only place the stake shows.
// Lives in Screen's sticky footer, persists after lock-in, and Outcome replaces it at reveal.
export function Stake({ amount, live = false }: { amount: number; live?: boolean }): JSX.Element {
  const L = useT(STRINGS);
  // I-026 C: the bet is live until the answer is locked — the footer breathes meanwhile.
  return (
    <div className={`${styles.stake} ${live && amount > 0 ? styles.stakeLive : ''}`}>
      {amount > 0 ? (
        <>
          🎲 <b>{L('Your bet: {amount}', { amount })}</b> ·{' '}
          {L('right +{amount} · wrong −{amount}', { amount })}
        </>
      ) : (
        <>🎲 {L('Nothing riding on this one — play for pride')}</>
      )}
    </div>
  );
}

/** "+850", "−240", "0" ("+0" with `signed`: the band's "+0 this round"). */
function deltaText(delta: number, signed = false): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return signed ? '+0' : '0';
}

export interface OutcomeProps {
  view: LightningControllerView;
  /** The streak this player carried into the question (myStreak is already reset at reveal). */
  streakBefore: number;
}

/**
 * I-790 C (the design review): the reveal is one band under the question — the verdict, then the
 * two numbers kept apart ("+0 this round · 1000 total": the old card's "Wrong … 1000 points" read
 * as if a wrong answer paid 1000). The tiles carry the rest: a green ring and "the answer" on the
 * right one, a red ring and "you" on a wrong pick. Plain digits, like every number in the game.
 */
export function Outcome({ view, streakBefore }: OutcomeProps): JSX.Element {
  const L = useT(STRINGS);
  const outcome = view.outcome;
  if (!outcome) {
    return (
      <p className={styles.footnote} role="status">
        {view.phoneOnly ? L('The answer is coming…') : L('Look at the TV')}
      </p>
    );
  }
  const final = view.round?.final === true;
  const noPick = view.myPickIndex === null;
  const verdict = outcome.correct
    ? L('Correct!')
    : noPick
      ? final
        ? L('No answer')
        : L('Too slow')
      : L('Wrong');
  const tone = outcome.correct ? styles.good : styles.bad;
  // a streak is still news: 🔥 n after a right answer, and a broken one says so
  const streak =
    outcome.correct && view.myStreak >= 2
      ? ` 🔥${view.myStreak}`
      : !outcome.correct && streakBefore >= 2
        ? ` · ${L('Streak of {streak} over', { streak: streakBefore })}`
        : '';
  return (
    <div className={`${styles.band} ${tone}`} role="status">
      <span className={styles.bandVerdict}>
        {verdict}
        {streak ? <span className={styles.bandStreak}>{streak}</span> : null}
      </span>
      <span className={styles.bandDelta}>
        {L('{delta} this round', { delta: deltaText(outcome.delta, true) })}
      </span>
      <span className={styles.bandTotal}>{L('{total} total', { total: view.myScore })}</span>
    </div>
  );
}

/** A "phone only" room reads the TV's reveal on the phone: who got it, the points, the totals. */
export function RoomRows({ rows }: { rows: RevealRow[] }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol className={styles.roomRows} aria-label={L("everyone's results")}>
      {rows.map((row) => (
        <li
          key={row.playerId}
          className={`${styles.roomRow} ${row.correct ? styles.roomRowOk : ''}`}
        >
          <Avatar avatarId={row.avatarId} size={24} dim={!row.connected} />
          <span className={styles.roomName}>{row.name}</span>
          <span className={styles.roomVerdict} aria-hidden>
            {row.correct ? '✓' : row.pickIndex !== null ? '✗' : '—'}
          </span>
          <span className={styles.roomDelta}>{deltaText(row.delta)}</span>
          <span className={styles.roomScore}>{row.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** I-288 B: "+812 now" — a right answer's worth this instant, draining with the speed bonus. */
export function Worth({
  worth,
  deadline,
  held = false,
  paused = false,
  clockHeldAt,
}: {
  worth: NonNullable<LightningControllerView['worth']>;
  deadline: number | null;
  /** Locked in: the line is hidden but keeps its height. */
  held?: boolean;
  paused?: boolean;
  clockHeldAt?: number;
}): JSX.Element | null {
  const L = useT(STRINGS);
  // The server's clock (the shell's offset), not this phone's: a phone a second off would promise
  // points the server does not give. Ten looks a second, like the branch.
  const now = useServerNow(100, paused, clockHeldAt);
  // No deadline yet: the line holds its place, so the answers below never move when it arrives.
  if (deadline === null)
    return (
      <span className={`${styles.worth} ${styles.worthHeld}`} aria-hidden>
        &nbsp;
      </span>
    );
  const left = Math.max(0, Math.min(worth.windowMs, deadline - now));
  const points = worth.base + Math.round(worth.speedMax * (left / worth.windowMs)) + worth.bonus;
  return (
    <span className={`${styles.worth} ${held ? styles.worthHeld : ''}`} aria-hidden={held}>
      {L('+{points} now', { points })}
    </span>
  );
}
