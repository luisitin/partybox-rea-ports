// Self-paced questions and private feedback. Only the server awards points and applies powers.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { TriviaControllerView } from '../server/index';
import type { Input } from '../server/types';
import { PhoneStage } from './PhoneStage';
import { PowerBar } from './PowerBar';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<TriviaControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const play = useSound();
  const [pending, setPending] = useState<{ key: string; choice: number; at: number } | null>(null);
  const cued = useRef('');
  const question = view.question;
  const key = question ? `${view.phaseAt}:${question.index}:${question.id}` : '';
  const seconds = view.deadline === null ? 0 : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const freeze = Math.max(0, Math.ceil((view.freezeUntil - now) / 1000));
  const waiting = pending?.key === key && now - pending.at < 4000;
  const retry = pending?.key === key && !waiting;
  const disabled = view.paused || freeze > 0 || seconds === 0;
  useEffect(() => {
    if (!view.feedback || view.me.role !== 'player') return;
    const feedbackKey = `${view.phaseAt}:${view.answered}`;
    if (cued.current === feedbackKey) return;
    cued.current = feedbackKey;
    buzz(view.feedback.correct ? [30, 40, 30] : 120);
    if (view.feedback.correct) play('correct');
  }, [view.phaseAt, view.answered, view.feedback, view.me.role, play]);

  if (view.me.role !== 'player' || view.phaseId !== 'race' || view.finished)
    return <PhoneStage view={view} seconds={seconds} />;

  return (
    <div className={styles.screen} data-frozen={freeze > 0 || undefined}>
      <header className={styles.stats}>
        <div>
          <b>{L('{n} / {total}', { n: view.answered, total: view.total })}</b>
          <span>{L('answered')}</span>
        </div>
        <div>
          <b>{view.score}</b>
          <span>{L('points')}</span>
        </div>
        <div className={styles.time} role="timer" aria-label={L('Race time left')}>
          <b>{view.paused ? 'Ⅱ' : `${seconds}s`}</b>
          <span>{view.paused ? L('paused') : L('left')}</span>
        </div>
      </header>
      <div className={styles.questionArea}>
        {view.feedback ? (
          <div className={styles.feedback} role="status" data-correct={view.feedback.correct}>
            <p className={styles.verdict}>
              {view.feedback.correct ? L('✓ Correct!') : L('✗ Not this time')}
            </p>
            <p className={styles.gain}>{L('+{n} points', { n: view.feedback.points })}</p>
            <h2>{view.feedback.answer}</h2>
            <p className={styles.explanation}>{view.feedback.explanation}</p>
            <button
              type="button"
              className={styles.next}
              disabled={disabled}
              onClick={() => send({ type: 'next', index: view.answered })}
            >
              {L('Next question →')}
            </button>
          </div>
        ) : question ? (
          <>
            <div className={styles.prompt}>
              <p className={styles.kicker}>
                {L('Question {n} of {total}', { n: question.index + 1, total: view.total })}
                {view.double ? <b>{L('×2 armed')}</b> : null}
              </p>
              <h2>{question.prompt}</h2>
            </div>
            <div className={styles.options} role="group" aria-label={L('Choose an answer')}>
              {question.options.map((option, choice) => (
                <button
                  key={`${question.id}:${choice}`}
                  type="button"
                  className={styles.option}
                  disabled={disabled || waiting}
                  data-selected={(waiting && pending?.choice === choice) || undefined}
                  onClick={() => {
                    buzz(15);
                    setPending({ key, choice, at: now });
                    send({
                      type: 'answer',
                      questionId: question.id,
                      index: question.index,
                      choice,
                    });
                  }}
                >
                  <span className={styles.letter} aria-hidden="true">
                    {'ABCD'[choice]}
                  </span>
                  <span>{option}</span>
                  {waiting && pending?.choice === choice ? <b aria-hidden="true">✓</b> : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <h2 className={styles.empty}>{L('Your next question is arriving…')}</h2>
        )}
      </div>
      <p className={styles.status} role="status">
        {freeze > 0
          ? L('❄ Frozen · Back in {n}s', { n: freeze })
          : waiting
            ? L('✓ Sending your answer…')
            : retry && !view.feedback
              ? L('Answer not confirmed — tap again')
              : view.streak > 1
                ? L('🔥 {n} correct in a row', { n: view.streak })
                : phoneOnly
                  ? L('Your pace. Your questions. Highest score wins.')
                  : L('Answer at your own pace. Highest score wins.')}
      </p>
      {view.powersEnabled ? (
        <PowerBar view={view} send={send} disabled={disabled || waiting} />
      ) : null}
    </div>
  );
}
