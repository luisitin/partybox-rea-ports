// Public group answer results follow the native prompt/vertical-bars/alternatives layout.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { QuestionOptions, SHAPES, Shape, choiceClass } from './ClassicParts';
import { GroupDecision, groupTitle } from './GroupParts';
import { STRINGS } from './strings';
import styles from './GroupAnswerChart.module.css';

/** Embeds in the parent's Stage/Screen; no duplicate shell or hidden question data. */
export function GroupAnswerChart({ view }: { view: LightningTvView }): JSX.Element | null {
  const L = useT(STRINGS);
  const { question, answerDistribution: distribution, correctIndex, group } = view;
  if (
    view.phaseId !== 'reveal' ||
    !group ||
    !question ||
    !distribution ||
    correctIndex === undefined
  )
    return null;
  const maximum = Math.max(1, ...distribution.counts);
  const vote = group.mode === 'tv-vote';
  return (
    <div className={styles.chart} data-group-answer-chart="vertical">
      <h2 className={styles.prompt}>{question.text}</h2>
      <ol
        className={styles.bars}
        aria-label={L(vote ? 'Vote distribution' : 'Answer distribution')}
      >
        {question.choices.map((answer, index) => {
          const count = distribution.counts[index] ?? 0;
          const correct = index === correctIndex;
          return (
            <li
              key={index}
              className={styles.column}
              data-correct={correct || undefined}
              aria-label={[
                L('{shape}: {answer}', { shape: L(SHAPES[index] ?? ''), answer }),
                L(vote ? '{n} votes' : '{n} answers', { n: count }),
                L(correct ? 'correct answer' : 'Wrong'),
              ].join(' · ')}
            >
              <div className={styles.track} aria-hidden="true">
                <div
                  className={[styles.fill, choiceClass(index)].join(' ')}
                  style={{ '--pb-group-chart-share': count / maximum } as CSSProperties}
                />
              </div>
              <div className={[styles.base, choiceClass(index)].join(' ')}>
                <Shape index={index} className={styles.shape} />
                <b aria-label={L(vote ? '{n} votes' : '{n} answers', { n: count })}>{count}</b>
                {correct ? (
                  <span className={styles.check} aria-label={L('correct answer')}>
                    ✓
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className={styles.choices}>
        <QuestionOptions question={question} correctIndex={correctIndex} />
      </div>
      <footer className={styles.footer}>
        <span className={styles.ordinal}>
          {L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 })}
        </span>
        <span>{L(groupTitle(group))}</span>
        <GroupDecision view={view} compact />
      </footer>
    </div>
  );
}
