// The authored explanation is its own readable beat after the native response chart.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { SHAPES, Shape, choiceClass } from './ClassicParts';
import { GroupDecision } from './GroupParts';
import { STRINGS } from './strings';
import styles from './GroupRevealStage.module.css';

/** Embeds in the existing Stage/Screen; the parent owns the shared reveal-beat clock. */
export function GroupExplanation({ view }: { view: LightningTvView }): JSX.Element | null {
  const L = useT(STRINGS);
  if (view.phaseId !== 'reveal' || !view.group) return null;
  const { question, correctIndex, explanation } = view;
  if (!question || correctIndex === undefined || !explanation) return null;
  const answer = question.choices[correctIndex];
  if (answer === undefined) return null;
  return (
    <div className={styles.explanation} data-group-explanation="true">
      <p className={styles.prompt}>{question.text}</p>
      <h2 className={styles.heading}>{L('Why this answer?')}</h2>
      <p
        className={[styles.correctChoice, choiceClass(correctIndex)].join(' ')}
        aria-label={[
          L('Correct answer'),
          L('{shape}: {answer}', { shape: L(SHAPES[correctIndex] ?? ''), answer }),
        ].join(' · ')}
      >
        <Shape index={correctIndex} className={styles.shape} />
        <b>{answer}</b>
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
      </p>
      <p className={styles.copy}>{explanation}</p>
      {view.group.mode === 'tv-vote' ? (
        <div className={styles.decision}>
          <GroupDecision view={view} compact />
        </div>
      ) : null}
    </div>
  );
}
