// First valid answer is immutable on the server. Local lock-in keeps a rapid second tap from sending another choice.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  MOTION_SLOW,
  Screen,
  buzz,
  useDraft,
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
import { TalkScreen } from './TalkScreen';
import { TeamReceipt } from './TeamParts';
import { pendingSnapshot, restorePending } from './pendingAnswer';
import type { PendingAnswer } from './pendingAnswer';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<QuizControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const spectator = view.me.role !== 'player';
  const seat = view.players.find((player) => player.id === view.me.id);
  const stage = phoneOnly || view.stage || spectator;
  const phase = view.phaseId;
  const slot = useDraft(`answer:${view.mode}:${view.round}:${view.phaseAt}:${view.me.id}`);
  const identity = `${phase}:${view.mode}:${view.round}:${view.phaseAt}:${view.me.id}`;
  const recoverable =
    phase === 'question' && !spectator && seat?.status === 'active' && !view.submitted;
  const [local, setLocal] = useState(() => ({
    slot,
    identity,
    pending: restorePending(slot, view.round, recoverable, now, MOTION_SLOW * 2),
  }));
  const pendingRef = useRef<PendingAnswer | null>(local.pending);
  const current = useRef({ slot, identity, canAnswer: false });
  if (local.slot !== slot || local.identity !== identity) {
    // A new SDK scope/round/role must hydrate before its controls commit, never from the old phone state.
    const pending = restorePending(slot, view.round, recoverable, now, MOTION_SLOW * 2);
    pendingRef.current = pending;
    setLocal({ slot, identity, pending });
  }
  const mine = recoverable && local.pending?.round === view.round ? local.pending : null;
  const canAnswer =
    phase === 'question' &&
    !spectator &&
    seat?.status === 'active' &&
    seat.connected &&
    !view.submitted &&
    !view.paused &&
    (view.deadline === null || now < view.deadline);
  current.current = { slot, identity, canAnswer };
  const selected = view.submitted ? view.selected : (mine?.choice ?? null);
  const retry = canAnswer && mine !== null && now - mine.at >= MOTION_SLOW * 2;
  const question = view.question;
  const round = L('Question {n} of {m}', { n: view.round, m: view.rounds });

  const answer = (choice: number): void => {
    if (
      current.current.slot !== slot ||
      current.current.identity !== identity ||
      !canAnswer ||
      !current.current.canAnswer ||
      pendingRef.current?.round === view.round
    )
      return;
    const next = { round: view.round, choice, at: now };
    const snapshot = pendingSnapshot(next);
    if (!snapshot) return;
    pendingRef.current = next;
    setLocal({ slot, identity, pending: next });
    slot.write(snapshot);
    buzz(20);
    send({ type: 'answer', round: view.round, choice });
  };
  const resend = (): void => {
    if (
      current.current.slot !== slot ||
      current.current.identity !== identity ||
      !current.current.canAnswer ||
      !retry ||
      !mine
    )
      return;
    const next = { ...mine, at: now };
    pendingRef.current = next;
    setLocal({ slot, identity, pending: next });
    slot.write(pendingSnapshot(next));
    send({ type: 'answer', round: view.round, choice: mine.choice });
  };
  const previousSlot = useRef(slot);
  useEffect(() => {
    if (previousSlot.current !== slot) previousSlot.current.clear();
    previousSlot.current = slot;
    if (!recoverable) {
      slot.clear();
      pendingRef.current = null;
      setLocal((value) =>
        value.slot === slot && value.identity === identity && value.pending
          ? { ...value, pending: null }
          : value,
      );
    } else if (pendingRef.current === null) slot.clear();
    // No unmount cleanup: the unresolved choice deliberately survives a phone refresh.
  }, [slot, identity, recoverable]);
  const judged = useRef(
    phase === 'reveal' && view.verdict ? `${view.round}:${view.verdict.outcome}` : '',
  );
  useEffect(() => {
    if (phase === 'talk' || phase === 'question') judged.current = '';
    if (phase !== 'reveal' || !view.verdict || spectator) return;
    const key = `${view.round}:${view.verdict.outcome}`;
    if (judged.current === key) return;
    judged.current = key;
    if (view.verdict.outcome === 'correct') {
      play('correct');
      buzz([30, 40, 30]);
    } else buzz(120);
  }, [phase, view.round, view.verdict, spectator, play]);

  if (phase === 'talk') return <TalkScreen view={view} now={now} />;

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
          view.mode === 'solo' ? (
            <VerdictCard verdict={view.verdict} rank={view.rank} compact={stage} />
          ) : (
            <TeamReceipt view={view} compact={stage} />
          )
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
          {view.team ? <b>{view.team.name}</b> : null}
          <b>{view.rank > 0 ? L('Place {rank}', { rank: view.rank }) : L('Podium reveal')}</b>
          <span>{L('{n} points', { n: view.score })}</span>
          {view.streak > 0 ? <span>{L('{n} correct in a row', { n: view.streak })}</span> : null}
        </div>
      ) : null}
      {stage || phase === 'done' ? (
        <PhoneStandings standings={view.standings} meId={view.team?.id ?? view.me.id} />
      ) : (
        <p className={styles.watch}>{L('Next question coming up')}</p>
      )}
    </Screen>
  );
}
