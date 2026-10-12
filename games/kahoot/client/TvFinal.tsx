// TV: the final-wager reveal — the biggest beat of the game, so it is paced instead of dropped in
// one frame. Bets first (smallest wager first, so the biggest bet flips last), then the answer,
// then verdict + delta per row, then the totals and the leader's outline, with one cue (jackpot
// if anyone won their bet, bust if nobody did). Under reduced motion every beat is 0 ms and the
// stage shows settled. Key by round and reveal clock so ordinary view pushes never restart it.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import {
  Avatar,
  beatAt,
  useReducedMotion,
  useServerNow,
  useSound,
  useT,
} from '@partybox/game-sdk/ui';
import type { QuestionView, RevealRow } from '../server/views';
import { topicLine } from './labels';
import { STRINGS } from './strings';
import { AnswerCard, deltaText, rowsClass, verdictOf } from './TvQuestion';
import styles from './Tv.module.css';
import { FINAL_REVEAL_HOLD_MS, finalTotalsDelay } from './timing';

const T_ANSWER_MS = 900;
const T_VERDICT_MS = FINAL_REVEAL_HOLD_MS;
const T_TOTALS_GAP_MS = 600;
const STEP_MAX_MS = 300;
const STEP_SPAN_MS = 1500;
/** `--pb-motion-slow` (600 ms) is the unit the per-row stagger is expressed in, so it scales to 0. */
const SLOW_MS = 600;

function byWager(a: RevealRow, b: RevealRow): number {
  return (
    (a.wagerAmount ?? 0) - (b.wagerAmount ?? 0) ||
    a.score - a.delta - (b.score - b.delta) ||
    a.playerId.localeCompare(b.playerId)
  );
}

export function FinalReveal({
  question,
  correctIndex,
  rows: unsorted,
  settled = false,
  startedAt,
  paused = false,
  clockHeldAt,
}: {
  question: QuestionView;
  correctIndex: number;
  rows: RevealRow[];
  /** The results stage: everything shown at once, no cue (the reveal already played). */
  settled?: boolean;
  /** Public room clock; standalone previews without it still start from mount. */
  startedAt?: number;
  paused?: boolean;
  clockHeldAt?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const rows = [...unsorted].sort(byWager);
  const n = rows.length;
  const stepMs = n > 1 ? Math.min(STEP_MAX_MS, STEP_SPAN_MS / (n - 1)) : 0;
  const lastMs = finalTotalsDelay(n) - T_TOTALS_GAP_MS;
  // The schedule is fixed for this mount: the row count cannot change inside one reveal.
  const now = useServerNow(100, paused, clockHeldAt);
  const [mountedAt] = useState(() => now);
  const since = startedAt ?? mountedAt;
  const elapsed = Math.max(0, mountedAt - since);
  const reduced = useReducedMotion();
  const beats = beatAt(Math.max(0, now - since), [
    0,
    T_ANSWER_MS,
    T_VERDICT_MS,
    lastMs,
    lastMs + T_TOTALS_GAP_MS,
  ]);
  const beat = settled || reduced ? 4 : beats;
  const skipped = settled ? lastMs + SLOW_MS : elapsed;
  const answered = beat >= 1;
  const judged = beat >= 2;
  const totals = beat >= 4;

  const play = useSound();
  // Claiming the phase on mount keeps the shell's mapped reveal sting out of the final: its own
  // cue is the jackpot/bust at the last row (child effects run before the shell's).
  useEffect(() => {
    if (!settled) play('silence');
  }, [play, settled]);
  const jackpot = rows.some((r) => r.delta > 0);
  const cued = useRef(settled || elapsed >= lastMs);
  useEffect(() => {
    if (paused || beat < 3 || cued.current) return;
    cued.current = true;
    play(jackpot ? 'jackpot' : 'bust');
  }, [beat, jackpot, paused, play]);

  const top = Math.max(0, ...rows.map((r) => r.score));
  const listStyle = {
    '--pb-final-step': `calc(var(--pb-motion-slow) * ${(stepMs / SLOW_MS).toFixed(4)})`,
    '--pb-final-row-skip': `${skipped}ms`,
    '--pb-final-verdict-skip': `${Math.max(0, skipped - T_VERDICT_MS)}ms`,
    '--pb-final-total-skip': `${Math.max(0, skipped - lastMs - T_TOTALS_GAP_MS)}ms`,
  } as CSSProperties;
  return (
    <>
      <div className={styles.header}>
        <span
          className={`${styles.kicker} ${styles.final}`}
          style={{ animationDelay: `${-skipped}ms` }}
        >
          {L('Final question · the bets are in')}
        </span>
        <span>{topicLine(question, L)}</span>
      </div>
      <p className={styles.asked}>{question.text}</p>
      <AnswerCard
        question={question}
        correctIndex={correctIndex}
        hidden={!answered}
        skipMs={Math.max(0, skipped - T_ANSWER_MS)}
      />
      <ol
        // Three or four bet rows (two lines each, under the question and the answer) ran past the
        // host bar in one column: they take two columns, like five to eight do.
        className={`${styles.rows} ${rowsClass(n > 2 ? Math.max(n, 5) : n)} ${styles.rowsFinal} ${paused ? styles.pausedFinal : ''}`}
        style={listStyle}
        aria-label={L('results')}
      >
        {rows.map((row, index) => {
          const verdict = verdictOf(row, L);
          const bet = row.wagerAmount ?? 0;
          const deltaClass =
            row.delta > 0 ? styles.deltaUp : row.delta < 0 ? styles.deltaDown : styles.deltaZero;
          const verdictClass = row.correct
            ? styles.verdictOk
            : row.pickIndex !== null
              ? styles.verdictNo
              : '';
          const leader = totals && top > 0 && row.score === top;
          return (
            <li
              key={row.playerId}
              className={`${styles.row} ${styles.rowFinal} ${leader ? styles.rowCorrect : ''}`}
              style={{ '--i': index } as CSSProperties}
            >
              <Avatar avatarId={row.avatarId} size={48} dim={!row.connected} />
              <span className={styles.stack}>
                <span className={styles.name} title={row.name}>
                  {row.name}
                </span>
                <span className={styles.bet}>
                  {judged ? (
                    <span className={`${styles.pop} ${verdictClass}`} aria-label={verdict.label}>
                      {verdict.glyph}&nbsp;
                    </span>
                  ) : null}
                  {bet > 0 ? L('bet {bet}', { bet }) : L('no bet')}
                  {totals ? (
                    <span className={`${styles.pop} ${styles.total}`}>
                      &nbsp;· {L(row.score === 1 ? '{n} pt' : '{n} pts', { n: row.score })}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className={`${styles.delta} ${styles.deltaFinal} ${deltaClass}`}>
                {judged ? <span className={styles.pop}>{deltaText(row.delta)}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
