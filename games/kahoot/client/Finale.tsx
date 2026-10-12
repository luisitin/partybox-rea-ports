// The results stage keeps the final-wager board up (bets, answer, deltas, totals) under the
// winner line until Play again / New game / Home — the game is decided here, and the room wants
// to look at it (owner request 2026-09-15). Rendered by the shell's TvResults through
// clientModule.Finale; `finale()` in index.ts says when this applies.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { GameFinaleProps } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { deltaText, verdictOf } from './TvQuestion';
import { STRINGS } from './strings';
import styles from './Finale.module.css';

export function Finale({ lastView, room }: GameFinaleProps<LightningTvView>): JSX.Element | null {
  const L = useT(STRINGS);
  const v = lastView;
  if (v.quizMode === 'classic') return null;
  if (!v.round?.final || !v.question || v.correctIndex === undefined) return null;
  const rows = [...(v.rows ?? [])].sort(
    (a, b) =>
      (a.wagerAmount ?? 0) - (b.wagerAmount ?? 0) ||
      a.score - a.delta - (b.score - b.delta) ||
      a.playerId.localeCompare(b.playerId),
  );
  const top = Math.max(0, ...rows.map((row) => row.score));
  const winners = room.results?.results.winnerIds ?? [];
  const players = room.results?.players ?? [];
  // The host names at most three tied winners; an all-player tie uses a short shared headline.
  // Long named ties need a smaller headline so the complete board remains at TV body size.
  const namedWinners = winners.length < players.length ? winners : [];
  const nameLengths = namedWinners
    .map((id) => players.find((player) => player.id === id)?.name.length ?? 0)
    .sort((a, b) => b - a);
  const compactHero =
    namedWinners.length >= 2 &&
    nameLengths.slice(0, namedWinners.length === 3 ? 3 : 2).reduce((sum, n) => sum + n, 0) >= 48;
  const letter = 'ABCD'[v.correctIndex] ?? '';
  return (
    <div
      className={styles.finaleRoot}
      data-compact-hero={compactHero || undefined}
      data-count={rows.length}
    >
      <div className={styles.content}>
        <div className={styles.answerBar}>
          <p
            className={styles.answer}
            role="status"
            aria-label={`${L('correct answer: {letter}', { letter })} · ${v.question.choices[v.correctIndex]}`}
          >
            <b className={styles.letter} aria-hidden="true">
              {letter}
            </b>
            <strong>{v.question.choices[v.correctIndex]}</strong>
            <span className={styles.mark} aria-hidden="true">
              ✓
            </span>
          </p>
          <p className={styles.legend}>{L('Bet · change · total')}</p>
        </div>
        <ol className={styles.receipts} data-count={rows.length} aria-label={L('results')}>
          {rows.map((row) => {
            const verdict = verdictOf(row, L);
            const bet = row.wagerAmount ?? 0;
            const delta = deltaText(row.delta);
            return (
              <li
                key={row.playerId}
                data-player={row.playerId}
                data-leader={(top > 0 && row.score === top) || undefined}
                aria-label={`${row.name} · ${verdict.label} · ${bet > 0 ? L('bet {bet}', { bet }) : L('no bet')} · ${delta} · ${L('{n} points', { n: row.score })}`}
              >
                <b className={styles.name} title={row.name}>
                  {row.name}
                </b>
                <span className={styles.numbers} aria-hidden="true">
                  <span className={styles.bet}>
                    <b className={row.correct ? styles.right : styles.wrong}>{verdict.glyph}</b>{' '}
                    {bet}
                  </span>
                  <span className={styles.separator}>·</span>
                  <span
                    className={
                      row.delta > 0 ? styles.right : row.delta < 0 ? styles.wrong : undefined
                    }
                  >
                    {delta}
                  </span>
                  <span className={styles.separator}>·</span>
                  <b>{row.score}</b>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
