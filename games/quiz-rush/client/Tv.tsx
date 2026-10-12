// The stage reveals the answer and placements. Timings and all scoring come from the server.
import type { JSX } from 'react';
import { Scoreboard, Stage, Timer, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { QuizTvView } from '../server/views';
import { Podium, RevealChart, Shape, choiceClass, scoreRows } from './QuestionParts';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<QuizTvView>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const question = view.question;
  const phase = view.phaseId;
  const round = L('Question {n} of {m}', { n: view.round, m: view.rounds });

  if (phase === 'question' && question) {
    return (
      <Stage className={styles.stage}>
        <div className={styles.question}>
          <header className={styles.questionHeader}>
            <div className={styles.progress}>
              <p className={styles.kicker}>{round}</p>
              <p className={styles.answered}>
                {L('{n} of {m} answered', { n: view.answered, m: view.eligible })}
              </p>
            </div>
            <Timer
              deadline={view.deadline}
              phaseKey={`${phase}:${view.round}`}
              phaseAt={view.phaseAt}
              paused={view.paused}
              clockHeldAt={view.clockHeldAt}
              onTick={() => play('countdown')}
            />
          </header>
          <h2 className={styles.prompt}>{question.prompt}</h2>
          <ol className={styles.options} aria-label={L('Answer choices')}>
            {question.options.map((option, choice) => (
              <li key={choice} className={`${styles.option} ${choiceClass(choice)}`}>
                <Shape choice={choice} className={styles.shape} />
                <span>{option}</span>
              </li>
            ))}
          </ol>
        </div>
      </Stage>
    );
  }

  if (phase === 'reveal' && question && view.reveal) {
    return (
      <Stage className={styles.stage}>
        <div className={styles.reveal}>
          <p className={styles.kicker}>{round}</p>
          <h2 className={styles.revealPrompt}>{question.prompt}</h2>
          <RevealChart question={question} reveal={view.reveal} />
        </div>
      </Stage>
    );
  }

  if (phase === 'podium') {
    return (
      <Stage className={styles.stage} center>
        <p className={styles.kicker}>{L('The podium')}</p>
        <h2 className={styles.headline}>
          {view.podiumStep === 0
            ? L('Third place')
            : view.podiumStep === 1
              ? L('Second place')
              : L('First place')}
        </h2>
        <Podium standings={view.standings} />
      </Stage>
    );
  }

  return (
    <Stage className={styles.stage} center>
      <p className={styles.kicker}>{phase === 'done' ? L('Quiz Rush') : round}</p>
      <h2 className={styles.headline}>
        {phase === 'done' ? L('Final standings') : L('Scoreboard')}
      </h2>
      <div className={styles.scoreboard}>
        <Scoreboard
          key={`${phase}:${view.round}`}
          rows={scoreRows(view.standings, phase === 'score')}
          columns={2}
          size="lg"
          stagger="down"
          noTrophy={view.standings.every((p) => p.score === 0)}
        />
      </div>
    </Stage>
  );
}
