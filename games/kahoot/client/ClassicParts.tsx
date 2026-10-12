// Original shape marks and public quiz displays, shared without importing the TV or question packs.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningTvView, QuestionView, StandingRow } from '../server/views';
import { STRINGS } from './strings';
import styles from './Classic.module.css';

export const SHAPES = ['Triangle', 'Diamond', 'Circle', 'Square'] as const;
export const choiceClass = (index: number): string => styles[`choice${index}`] ?? '';

export function Shape({ index, className }: { index: number; className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {index === 0 ? <path d="M24 5 45 42H3Z" fill="currentColor" /> : null}
      {index === 1 ? <path d="m24 2 22 22-22 22L2 24Z" fill="currentColor" /> : null}
      {index === 2 ? <circle cx="24" cy="24" r="21" fill="currentColor" /> : null}
      {index === 3 ? <rect x="5" y="5" width="38" height="38" rx="2" fill="currentColor" /> : null}
    </svg>
  );
}

export function QuestionOptions({
  question,
  letters = false,
}: {
  question: QuestionView;
  letters?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol className={styles.options} aria-label={L('Answer choices')}>
      {question.choices.map((text, index) => (
        <li
          key={index}
          className={`${styles.option} ${choiceClass(index)}`}
          aria-label={`${letters ? 'ABCD'[index] : L(SHAPES[index] ?? '')}: ${text}`}
        >
          {letters ? (
            <b className={styles.shape}>{'ABCD'[index]}</b>
          ) : (
            <Shape index={index} className={styles.shape} />
          )}
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

export function ClassicChart({ view }: { view: LightningTvView }): JSX.Element | null {
  const L = useT(STRINGS);
  const { question, answerDistribution: distribution, correctIndex } = view;
  if (!question || !distribution || correctIndex === undefined) return null;
  const max = Math.max(1, ...distribution.counts);
  const vote = view.group?.mode === 'tv-vote';
  return (
    <div className={styles.chartSummary}>
      <ol
        className={styles.chart}
        aria-label={L(vote ? 'Vote distribution' : 'Answer distribution')}
      >
        {question.choices.map((text, index) => {
          const correct = index === correctIndex;
          const count = distribution.counts[index] ?? 0;
          return (
            <li
              key={index}
              className={styles.chartRow}
              data-correct={correct || undefined}
              aria-label={`${L(SHAPES[index] ?? '')}: ${text} · ${L(vote ? '{n} votes' : '{n} answers', { n: count })}${correct ? ` · ${L('correct answer')}` : ''}`}
            >
              <span className={`${styles.chartMark} ${choiceClass(index)}`}>
                <Shape index={index} className={styles.shape} />
              </span>
              <span className={styles.chartAnswer}>
                {text}
                <span className={styles.barTrack} aria-hidden="true">
                  <span
                    className={styles.bar}
                    style={{ '--pb-classic-share': count / max } as CSSProperties}
                  />
                </span>
              </span>
              <b aria-label={L(vote ? '{n} votes' : '{n} answers', { n: count })}>{count}</b>
              <span className={styles.correct}>{correct ? L('✓ Correct') : ''}</span>
            </li>
          );
        })}
      </ol>
      {view.explanation ? <p className={styles.explanation}>{view.explanation}</p> : null}
      {distribution.missed > 0 ? (
        <p className={styles.missed}>
          {L(vote ? '{n} did not vote' : '{n} did not answer', { n: distribution.missed })}
        </p>
      ) : null}
    </div>
  );
}

export function PublicStandings({
  rows,
  me,
  gains = false,
}: {
  rows: readonly StandingRow[];
  me?: string;
  gains?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol className={styles.standings} data-count={rows.length} aria-label={L('Standings')}>
      {rows.map((row) => (
        <li
          key={row.playerId}
          data-me={row.playerId === me || undefined}
          aria-label={`${row.name} · ${L('Place {rank}', { rank: row.rank })} · ${L('{n} points', { n: row.score })}${gains && 'delta' in row && typeof row.delta === 'number' && row.delta > 0 ? ` · ${L('+{n} points', { n: row.delta })}` : ''}`}
        >
          <b className={styles.rank}>#{row.rank}</b>
          <b className={styles.name} title={row.name}>
            {row.name}
          </b>
          <span className={styles.score}>{row.score}</span>
          {gains && 'delta' in row && typeof row.delta === 'number' && row.delta > 0 ? (
            <span className={styles.gain}>+{row.delta}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function Podium({ view }: { view: Pick<LightningTvView, 'podium'> }): JSX.Element | null {
  const L = useT(STRINGS);
  const podium = view.podium;
  if (!podium) return null;
  const crowded = [1, 2, 3].some(
    (rank) => podium.entries.filter((entry) => entry.rank === rank).length > 2,
  );
  if (crowded) return <PublicStandings rows={podium.entries} />;
  return (
    <div className={styles.podium} aria-label={L('Podium')}>
      {[2, 1, 3].map((rank) => {
        const entries = podium.entries.filter((entry) => entry.rank === rank);
        return (
          <section
            key={rank}
            className={styles.podiumPlace}
            data-rank={rank}
            data-revealed={entries.length > 0 || undefined}
            aria-label={L(rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd')}
          >
            <div className={styles.podiumPeople}>
              {entries.map((entry) => (
                <div key={entry.playerId}>
                  <b>{entry.name}</b>
                  <span>{L('{n} points', { n: entry.score })}</span>
                </div>
              ))}
            </div>
            <b className={styles.plinth}>{L(rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd')}</b>
          </section>
        );
      })}
    </div>
  );
}

export const podiumLabel = (rank: number): string =>
  rank === 3 ? 'Third place' : rank === 2 ? 'Second place' : 'First place';
