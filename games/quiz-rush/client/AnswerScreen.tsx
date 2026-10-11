// The question's display is shared by TV-room controllers, remote players and spectators.
import type { JSX } from 'react';
import { PrimaryButton, Screen, useT } from '@partybox/game-sdk/ui';
import type { QuizControllerView } from '../server/views';
import { SHAPES, Shape, choiceClass } from './QuestionParts';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

interface AnswerScreenProps {
  view: QuizControllerView;
  stage: boolean;
  now: number;
  canAnswer: boolean;
  selected: number | null;
  pending: boolean;
  retry: boolean;
  answer: (choice: number) => void;
  resend: () => void;
}

export function AnswerScreen({
  view,
  stage,
  now,
  canAnswer,
  selected,
  pending,
  retry,
  answer,
  resend,
}: AnswerScreenProps): JSX.Element {
  const L = useT(STRINGS);
  const spectator = view.me.role !== 'player';
  const seat = view.players.find((player) => player.id === view.me.id);
  const waiting = seat?.status === 'waiting';
  const disconnected = seat?.connected === false;
  const question = view.question;
  const seconds =
    view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const status =
    spectator || waiting
      ? L('Watching the quiz')
      : disconnected
        ? L('Disconnected. Waiting to reconnect.')
        : view.submitted
          ? L('✓ Answer locked in')
          : seconds === 0
            ? L('Time is up')
            : pending
              ? retry
                ? L('Not confirmed yet. Send your answer again.')
                : L('Sending your answer…')
              : L('Tap the matching shape');
  return (
    <Screen key={`question:${view.round}`} className={styles.screen} ghost={false}>
      <div
        className={styles.question}
        data-stage={stage || undefined}
        data-spectator={spectator || undefined}
      >
        <header className={styles.header}>
          <h2 className={styles.round}>
            {L('Question {n} of {m}', { n: view.round, m: view.rounds })}
          </h2>
          {stage && seconds !== null ? (
            <span
              className={styles.clock}
              role="timer"
              aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: seconds })}
            >
              {view.paused ? L('Paused') : seconds}
            </span>
          ) : null}
        </header>
        {stage && question ? <h3 className={styles.prompt}>{question.prompt}</h3> : null}
        {spectator && question ? (
          <ol className={styles.spectatorOptions} aria-label={L('Answer choices')}>
            {question.options.map((option, choice) => (
              <li key={choice} className={choiceClass(choice)}>
                <Shape choice={choice} className={styles.optionShape} />
                <span>{option}</span>
              </li>
            ))}
          </ol>
        ) : !spectator ? (
          <div className={styles.pads} role="group" aria-label={L('Answer choices')}>
            {SHAPES.map((shape, choice) => (
              <button
                key={choice}
                type="button"
                className={`${styles.pad} ${choiceClass(choice)}`}
                data-selected={selected === choice || undefined}
                aria-label={
                  stage && question
                    ? L('{shape}: {answer}', {
                        shape: L(shape),
                        answer: question.options[choice] ?? '',
                      })
                    : L(shape)
                }
                aria-pressed={selected === choice}
                disabled={!canAnswer || selected !== null}
                onClick={() => answer(choice)}
              >
                <Shape choice={choice} className={styles.padShape} />
                {stage && question ? (
                  <span className={styles.padText}>{question.options[choice]}</span>
                ) : null}
                {selected === choice ? (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.answerStatus}>
          <p className={styles.status} role="status">
            {status}
          </p>
          {retry ? <PrimaryButton onClick={resend}>{L('Send again')}</PrimaryButton> : null}
        </div>
      </div>
    </Screen>
  );
}
