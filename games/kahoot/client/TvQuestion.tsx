// TV: the question, its four lettered choices in a 2×2 grid, and — in reveal — the correct one
// marked with ✓ (never colour-only) plus one row per player with verdict, points and streak.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Avatar, BigText, LeadMark, useServerOffset, useT } from '@partybox/game-sdk/ui';
import type { Translator, ViewPlayer } from '@partybox/game-sdk/ui';
import type { QuestionView, RevealRow, RoundView } from '../server/views';
import { roundLabel, topicLine, waitingText } from './labels';
import { STRINGS } from './strings';
import { rowBoxes, slideRows } from './flip';
import { standingsDelay } from './timing';
import { revealElapsed } from './reveal-clock';
import styles from './Tv.module.css';

const LETTERS = ['A', 'B', 'C', 'D'];
export function RoundHeader({
  round,
  question,
  aside,
}: {
  round: RoundView | null;
  question: QuestionView | null;
  /** I-589: the standings' Next button, in the topic's place. */
  aside?: JSX.Element | null;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <div className={styles.header}>
      <span className={`${styles.kicker} ${round?.final ? styles.final : ''}`}>
        {roundLabel(round, L)}
      </span>
      {aside ?? (question ? <span>{topicLine(question, L)}</span> : null)}
    </div>
  );
}
export function ChoiceBoard({
  question,
  correctIndex,
}: {
  question: QuestionView;
  /** Undefined until the reveal. */
  correctIndex?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const revealed = correctIndex !== undefined;
  return (
    <div className={styles.grid} role="list" aria-label={L('choices')}>
      {question.choices.map((text, index) => {
        const isCorrect = revealed && index === correctIndex;
        const classes = [
          styles.choice,
          isCorrect ? styles.correct : '',
          revealed && !isCorrect ? styles.dim : '',
        ].join(' ');
        return (
          <div
            key={index}
            role="listitem"
            className={classes}
            style={{ '--i': index } as CSSProperties}
          >
            <span className={styles.letter} aria-hidden>
              {LETTERS[index]}
            </span>
            <span>{text}</span>
            <span className={styles.mark} aria-hidden>
              {isCorrect ? '✓' : ''}
            </span>
            {isCorrect ? <span className="pb-visually-hidden">{L('correct answer')}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Reveal: the one fact the room wants — "it was A · Neil Armstrong" — as the biggest text on stage. */
export function AnswerCard({
  question,
  correctIndex,
  hidden,
  skipMs = 0,
}: {
  question: QuestionView;
  correctIndex: number;
  /** Held back (invisible, space reserved) until a choreographed beat; the pop plays on unhide. */
  hidden?: boolean;
  /** A late final reveal skips the already-played part of the answer's entrance. */
  skipMs?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <div
      className={`${styles.choice} ${styles.answer} ${hidden ? styles.answerHidden : ''}`}
      style={{ animationDelay: `${-skipMs}ms` }}
      role="status"
    >
      <span className={styles.letter} aria-hidden>
        {LETTERS[correctIndex]}
      </span>
      <span>{question.choices[correctIndex]}</span>
      <span className={styles.mark} aria-hidden>
        ✓
      </span>
      <span className="pb-visually-hidden">
        {L('correct answer: {letter}', { letter: LETTERS[correctIndex] ?? '' })}
      </span>
    </div>
  );
}

/**
 * Who the room is waiting for: connected players who have not locked in.
 * Derive the names from player status, using the same connected roster as the count.
 */
export function holdoutsOf(players: ViewPlayer[]): string[] {
  return players.filter((p) => p.connected && p.status === 'active').map((p) => p.name);
}

/** "3 / 6 locked in · waiting for Sam and Priya" — the number pops on every change. */
export function CountLine({
  answeredCount,
  totalCount,
  players,
  verb,
}: {
  answeredCount: number;
  totalCount: number;
  players: ViewPlayer[];
  verb: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const holdouts = holdoutsOf(players);
  // I-007 A: the crowd builds — every locked-in face pops onto the line (keyed per player, so
  // each pops once, in the order the view lists them).
  const lockedIn = players.filter((p) => p.connected && p.status === 'submitted');
  return (
    <p className={`${styles.count} ${players.length > 8 ? styles.countDense : ''}`} role="status">
      {lockedIn.length > 0 ? (
        <span className={styles.crowd} aria-hidden>
          {lockedIn.map((p) => (
            <span key={p.id} className={styles.crowdFace}>
              <Avatar avatarId={p.avatarId} size="var(--pb-space-7)" />
            </span>
          ))}
        </span>
      ) : null}
      <span key={answeredCount} className={styles.countNum}>
        {answeredCount} / {totalCount}
      </span>{' '}
      {verb}
      {holdouts.length >= 1 && holdouts.length <= 3 ? (
        <span className={styles.holdouts}> · {waitingText(holdouts, L)}</span>
      ) : null}
    </p>
  );
}
export function TvQuestion({
  round,
  question,
  answeredCount,
  totalCount,
  players,
}: {
  round: RoundView | null;
  question: QuestionView | null;
  answeredCount: number;
  totalCount: number;
  players: ViewPlayer[];
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <>
      <RoundHeader round={round} question={question} />
      <BigText level="h1" className={styles.prompt}>
        {question?.text ?? '…'}
      </BigText>
      {question ? <ChoiceBoard question={question} /> : null}
      <CountLine
        answeredCount={answeredCount}
        totalCount={totalCount}
        players={players}
        verb={L('locked in')}
      />
    </>
  );
}

/** Verdict glyph with the pick folded in — "A✓", "D✗" or "–" — so the room sees who picked what. */
export function verdictOf(row: RevealRow, L: Translator): { glyph: string; label: string } {
  if (row.pickIndex === null) return { glyph: '–', label: L('no answer') };
  const letter = LETTERS[row.pickIndex] ?? '';
  if (row.correct) return { glyph: `${letter}✓`, label: L('picked {letter}, correct', { letter }) };
  return { glyph: `${letter}✗`, label: L('picked {letter}, wrong', { letter }) };
}
export function deltaText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return '0';
}

/** Explicit columns by player count (never auto-fit): every count stays within four 60 px rows. */
export function rowsClass(count: number): string {
  // Four or fewer: one column of taller rows, so a three-player board does not sit in the top
  // third of the stage (pass 871).
  return (
    (count <= 4
      ? styles.rows1
      : count <= 8
        ? styles.rows2
        : count <= 12
          ? styles.rows3
          : styles.rows4) ?? ''
  );
}
export function RevealRows({
  rows: raced,
  startedAt,
  paused = false,
  clockHeldAt,
  leaderboardAt,
}: {
  rows: RevealRow[];
  /** The reveal's start on the room's clock (`revealAt`): a TV that reloads mid-reveal lands on
   *  the current beat instead of replaying the race. Previews without it count from the mount. */
  startedAt?: number;
  paused?: boolean;
  clockHeldAt?: number;
  /** Server-computed end of the reading-safe race, aligned with revealAt after a pause. */
  leaderboardAt?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const offset = useServerOffset();
  // I-589 B: the race first, then the standings. T-0190: the race counts from when its rows have
  // landed, and the same rows slide into the standings' order (they used to remount and deal in
  // again, so the list was empty half a second after it landed).
  // Read once at mount: the rows are keyed by the reveal (one mount per reveal).
  const [mountedAt] = useState(() => Date.now() + offset);
  const since = startedAt ?? mountedAt;
  const standingsMs = standingsDelay(startedAt, leaderboardAt);
  const [standings, setStandings] = useState(
    () => revealElapsed(since, offset, paused ? clockHeldAt : undefined) >= standingsMs,
  );
  const list = useRef<HTMLOListElement>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  useEffect(() => {
    if (paused || standings) return;
    const settle = (): void => {
      before.current = rowBoxes(list.current);
      setStandings(true);
    };
    const wait = standingsMs - revealElapsed(since, offset);
    if (wait <= 0) {
      settle();
      return;
    }
    const h = setTimeout(settle, wait);
    return () => clearTimeout(h);
  }, [since, offset, paused, standings, standingsMs]);
  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (standings && from && list.current) slideRows(list.current, from);
  }, [standings]);
  const rows = standings
    ? [...raced].sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
    : raced;
  const fastest = rows
    .filter((r) => r.elapsedMs !== undefined)
    .reduce<number | null>(
      (m, r) => (m === null || (r.elapsedMs ?? 0) < m ? (r.elapsedMs ?? 0) : m),
      null,
    );
  const wide = rows.length <= 8;
  const crowned = rows.length <= 12;
  const top = Math.max(0, ...rows.map((r) => r.score));
  // I-268 B: the roster's rule — no leader when nobody has scored or everyone is tied
  const leads = top > 0 && rows.some((r) => r.score !== top);
  return (
    <ol
      ref={list}
      className={`${styles.rows} ${rowsClass(rows.length)} ${standings ? styles.settled : ''}`}
      aria-label={L('results')}
    >
      {rows.map((row, index) => {
        const verdict = verdictOf(row, L);
        const quiet = row.delta === 0;
        const deltaClass = row.delta > 0 ? styles.deltaUp : row.delta < 0 ? styles.deltaDown : '';
        const verdictClass = row.correct
          ? styles.verdictOk
          : row.pickIndex !== null
            ? styles.verdictNo
            : '';
        return (
          <li
            key={row.playerId}
            data-player={row.playerId}
            className={`${styles.row} ${row.correct ? styles.rowCorrect : ''} ${quiet ? styles.rowQuiet : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <Avatar avatarId={row.avatarId} size={48} dim={!row.connected} />
            {crowned && leads && row.score === top ? <LeadMark className={styles.crown} /> : null}
            <span className={styles.name}>{row.name}</span>
            {row.streak >= 2 ? (
              <span
                className={`${styles.streak} ${row.streak >= 3 ? styles.streakHot : ''}`}
                aria-label={L('streak {streak}', { streak: row.streak })}
              >
                🔥{row.streak}
              </span>
            ) : null}
            <span className={`${styles.verdict} ${verdictClass}`} aria-label={verdict.label}>
              {verdict.glyph}
            </span>
            {/* I-589 A: how fast — the fastest gets the bolt */}
            {row.elapsedMs !== undefined && !standings ? (
              <span className={styles.raceTime}>
                {row.elapsedMs === fastest ? '⚡ ' : ''}
                {(row.elapsedMs / 1000).toFixed(1)} s
              </span>
            ) : null}
            <span className={`${styles.delta} ${deltaClass}`}>{deltaText(row.delta)}</span>
            {wide ? <span className={styles.score}>{row.score}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
