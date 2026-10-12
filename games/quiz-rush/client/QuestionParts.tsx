// Shared presentation only: a phone never downloads the TV component or an answer key.
import type { CSSProperties, JSX } from 'react';
import { Avatar, useT } from '@partybox/game-sdk/ui';
import type { ScoreboardRow } from '@partybox/game-sdk/ui';
import type { PublicQuestion, RevealData, Standing } from '../server/views';
import { STRINGS } from './strings';
import styles from './QuestionParts.module.css';

export const SHAPES = ['Triangle', 'Diamond', 'Circle', 'Square'] as const;

export function choiceClass(choice: number): string {
  return styles[`choice${choice}`] ?? '';
}

/** Original vector marks. Shapes match the stage to the controller without depending on colour. */
export function Shape({ choice, className }: { choice: number; className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {choice === 0 ? <path d="M24 5 45 42H3Z" fill="currentColor" /> : null}
      {choice === 1 ? <path d="m24 2 22 22-22 22L2 24Z" fill="currentColor" /> : null}
      {choice === 2 ? <circle cx="24" cy="24" r="21" fill="currentColor" /> : null}
      {choice === 3 ? <rect x="5" y="5" width="38" height="38" rx="2" fill="currentColor" /> : null}
    </svg>
  );
}

export function scoreRows(standings: readonly Standing[], gains = false): ScoreboardRow[] {
  return standings.map((p) => ({
    playerId: p.id,
    name: p.name,
    avatarId: p.avatarId,
    rank: p.rank,
    score: p.score,
    ...(gains ? { delta: p.gained } : {}),
  }));
}

export function RevealChart({
  question,
  reveal,
  compact = false,
}: {
  question: PublicQuestion;
  reveal: RevealData;
  compact?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const max = Math.max(1, ...reveal.counts);
  return (
    <div className={styles.reveal} data-compact={compact || undefined}>
      <ul className={styles.chart} aria-label={L('Answer distribution')}>
        {question.options.map((option, choice) => {
          const correct = choice === reveal.correctChoice;
          const count = reveal.counts[choice] ?? 0;
          return (
            <li key={choice} className={choiceClass(choice)} data-correct={correct || undefined}>
              <Shape choice={choice} className={styles.chartShape} />
              <div className={styles.chartText}>
                <span className={styles.optionText}>{option}</span>
                <div className={styles.barTrack} aria-hidden="true">
                  <div
                    className={styles.bar}
                    style={{ '--pb-quiz-bar-scale': count / max } as CSSProperties}
                  />
                </div>
              </div>
              <span className={styles.count} aria-label={L('{n} answers', { n: count })}>
                {count}
              </span>
              <span className={styles.correct}>{correct ? L('✓ Correct') : ''}</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.explanation}>{question.options[reveal.correctChoice]}</p>
      <p className={styles.fact}>{reveal.explanation}</p>
      {reveal.missed > 0 ? (
        <p className={styles.missed}>{L('{n} did not answer', { n: reveal.missed })}</p>
      ) : null}
    </div>
  );
}

/** Only names already revealed by the server enter the DOM; an unrevealed slot stays blank. */
export function Podium({
  standings,
  compact = false,
}: {
  standings: readonly Standing[];
  compact?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const crowded = [1, 2, 3].some((rank) => standings.filter((p) => p.rank === rank).length > 3);
  return (
    <div
      className={styles.podium}
      data-compact={compact || undefined}
      data-crowded={crowded || undefined}
      aria-label={L('Podium')}
    >
      {[2, 1, 3].map((rank) => {
        const placed = standings.filter((p) => p.rank === rank);
        const place = rank === 1 ? L('1st') : rank === 2 ? L('2nd') : L('3rd');
        return (
          <section
            key={rank}
            className={styles.podiumPlace}
            data-rank={rank}
            data-revealed={placed.length > 0 || undefined}
            aria-label={place}
          >
            <div className={styles.podiumPeople} data-many={placed.length > 3 || undefined}>
              {placed.map((p) => (
                <div key={p.id} className={styles.podiumPerson}>
                  <Avatar avatarId={p.avatarId} size="var(--pb-chip-size)" />
                  <b className={styles.podiumName}>{p.name}</b>
                  <span className={styles.podiumScore}>{L('{n} points', { n: p.score })}</span>
                </div>
              ))}
            </div>
            <span className={styles.plinth}>{place}</span>
          </section>
        );
      })}
    </div>
  );
}
