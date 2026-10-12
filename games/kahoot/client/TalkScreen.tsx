import type { JSX } from 'react';
import { Screen, useT } from '@partybox/game-sdk/ui';
import type { QuizControllerView } from '../server/views';
import { Shape, choiceClass } from './QuestionParts';
import { TeamHeader } from './TeamParts';
import { STRINGS } from './strings';
import styles from './Teams.module.css';

export function TalkScreen({ view, now }: { view: QuizControllerView; now: number }): JSX.Element {
  const L = useT(STRINGS);
  const seconds = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  return (
    <Screen className={styles.talkScreen} ghost={false}>
      <div className={styles.talk}>
        <header>
          <div>
            <p>{L('Question {n} of {m}', { n: view.round, m: view.rounds })}</p>
            <h2>{view.mode === 'teams' ? L('Discuss with your team') : L('Discuss together')}</h2>
          </div>
          <b
            className={styles.clock}
            role="timer"
            aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: seconds })}
          >
            {view.paused ? L('Paused') : seconds}
          </b>
        </header>
        {view.team ? (
          <div>
            <TeamHeader view={view} />
            {view.mode === 'teams' ? (
              <p className={styles.members}>
                {view.team.members
                  .map((id) => view.players.find((p) => p.id === id)?.name ?? id)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}
        {view.question ? (
          <>
            <h3 className={styles.prompt}>{view.question.prompt}</h3>
            <ol className={styles.choices} aria-label={L('Answer choices')}>
              {view.question.options.map((option, choice) => (
                <li key={choice} className={choiceClass(choice)}>
                  <Shape choice={choice} className={styles.shape} />
                  <span>{option}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
        <p className={styles.wait} role="status">
          {view.paused ? L('Paused') : L('Answers open when discussion ends')}
        </p>
      </div>
    </Screen>
  );
}
