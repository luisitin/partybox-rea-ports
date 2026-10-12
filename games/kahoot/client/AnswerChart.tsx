// Quiz Rush's answer distribution, using Lightning's letters and tokens beside the muted question.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningTvView, QuestionView } from '../server/views';
import { STRINGS } from './strings';
import styles from './AnswerChart.module.css';

export function AnswerChart({
  question,
  correctIndex,
  distribution,
}: {
  question: QuestionView;
  correctIndex: number;
  distribution: NonNullable<LightningTvView['answerDistribution']>;
}): JSX.Element {
  const L = useT(STRINGS);
  const counts = [...distribution.counts, distribution.missed];
  const max = Math.max(1, ...counts);
  return (
    <ol className={styles.chart} aria-label={L('Answer distribution')}>
      {counts.map((count, index) => {
        const correct = index === correctIndex;
        const letter = ['A', 'B', 'C', 'D'][index] ?? L('No answer');
        return (
          <li
            key={index}
            className={correct ? styles.correct : undefined}
            aria-label={
              index === 4
                ? L('{n} did not answer', { n: count })
                : `${letter}: ${question.choices[index] ?? ''} · ${L('{n} answers', { n: count })}${correct ? ` · ${L('correct answer')}` : ''}`
            }
          >
            <span className={styles.pair} aria-hidden="true">
              <span className={styles.label}>
                {letter}
                {correct ? '✓' : ''}
              </span>
              <b>{count}</b>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.bar}
                style={{ '--pb-answer-share': count / max } as CSSProperties}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
