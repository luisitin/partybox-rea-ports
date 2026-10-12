// First valid answer is immutable on the server. Local lock-in keeps a rapid second tap from sending another choice.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  MOTION_SLOW,
  Screen,
  buzz,
  usePhoneOnly,
  useServerNow,
  useSound,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import type { QuizControllerView } from '../server/views';
import { AnswerScreen } from './AnswerScreen';
import { Podium, RevealChart } from './QuestionParts';
import { PhoneStandings, VerdictCard } from './PhoneParts';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

interface Pending {
  round: number;
  choice: number;
  at: number;
}

export function Controller({
  view,
  send,
}: GameControllerProps<QuizControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const mine = pending?.round === view.round ? pending : null;
  const spectator = view.me.role !== 'player';
  const seat = view.players.find((player) => player.id === view.me.id);
  const stage = phoneOnly || view.stage || spectator;
  const phase = view.phaseId;
  const canAnswer =
    phase === 'question' &&
    !spectator &&
    seat?.status === 'active' &&
    seat.connected &&
    !view.submitted &&
    !view.paused &&
    (view.deadline === null || now < view.deadline);
  const selected = view.submitted ? view.selected : (mine?.choice ?? null);
  const retry = canAnswer && mine !== null && now - mine.at >= MOTION_SLOW * 2;
  const question = view.question;
  const round = L('Question {n} of {m}', { n: view.round, m: view.rounds });

  const answer = (choice: number): void => {
    if (!canAnswer || pendingRef.current?.round === view.round) return;
    const next = { round: view.round, choice, at: now };
    pendingRef.current = next;
    setPending(next);
    buzz(20);
    send({ type: 'answer', round: view.round, choice });
  };
  const resend = (): void => {
    if (!retry || !mine) return;
    const next = { ...mine, at: now };
    pendingRef.current = next;
    setPending(next);
    send({ type: 'answer', round: view.round, choice: mine.choice });
  };
  const judged = useRef('');
  useEffect(() => {
    if (phase !== 'reveal' || !view.verdict || spectator) return;
    const key = `${view.round}:${view.verdict.outcome}`;
    if (judged.current === key) return;
    judged.current = key;
    if (view.verdict.outcome === 'correct') {
      play('correct');
      buzz([30, 40, 30]);
    } else buzz(120);
  }, [phase, view.round, view.verdict, spectator, play]);

  if (phase === 'question') {
    return (
      <AnswerScreen
        view={view}
        stage={stage}
        now={now}
        canAnswer={canAnswer}
        selected={selected}
        pending={mine !== null}
        retry={retry}
        answer={answer}
        resend={resend}
      />
    );
  }

  if (phase === 'reveal') {
    return (
      <Screen key={`reveal:${view.round}`} className={styles.screen} title={round}>
        {!spectator && view.verdict ? (
          <VerdictCard verdict={view.verdict} rank={view.rank} compact={stage} />
        ) : null}
        {stage && question && view.reveal ? (
          <RevealChart question={question} reveal={view.reveal} compact />
        ) : null}
      </Screen>
    );
  }

  if (phase === 'podium') {
    return (
      <Screen key={`podium:${view.podiumStep}`} className={styles.screen} title={L('The podium')}>
        <p className={styles.podiumBeat}>
          {view.podiumStep === 0
            ? L('Third place')
            : view.podiumStep === 1
              ? L('Second place')
              : L('First place')}
        </p>
        {stage ? (
          <Podium standings={view.standings} compact />
        ) : (
          <p className={styles.watch}>{L('The final places are being revealed')}</p>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      key={`${phase}:${view.round}`}
      className={styles.screen}
      title={phase === 'done' ? L('Final standings') : L('Scoreboard')}
    >
      {!spectator ? (
        <div className={styles.personal} data-compact={stage || undefined}>
          <b>{view.rank > 0 ? L('Place {rank}', { rank: view.rank }) : L('Podium reveal')}</b>
          <span>{L('{n} points', { n: view.score })}</span>
          {view.streak > 0 ? <span>{L('{n} correct in a row', { n: view.streak })}</span> : null}
        </div>
      ) : null}
      {stage || phase === 'done' ? (
        <PhoneStandings standings={view.standings} meId={view.me.id} />
      ) : (
        <p className={styles.watch}>{L('Next question coming up')}</p>
      )}
    </Screen>
  );
}
