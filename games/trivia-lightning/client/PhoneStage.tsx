// The public stage on a phone, including spectators. It never contains gameplay buttons.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { TriviaControllerView } from '../server/index';
import { Podium } from './Podium';
import { RaceTrack } from './RaceTrack';
import { STRINGS } from './strings';
import styles from './PhoneStage.module.css';

export function PhoneStage({
  view,
  seconds,
}: {
  view: TriviaControllerView;
  seconds: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const player = view.me.role === 'player';
  const final = view.phaseId === 'done' || view.podiumStep >= 3;
  const top = Math.max(0, ...view.lanes.map((lane) => lane.score));
  const winners = view.lanes.filter((lane) => lane.score === top);
  const heading =
    view.phaseId === 'race'
      ? player
        ? L('You finished!')
        : L('The race is on')
      : !final
        ? L('The podium')
        : winners.length > 1
          ? L('Shared first place!')
          : L('{name} wins!', { name: winners[0]?.name ?? '' });
  return (
    <div className={styles.stage}>
      <header className={styles.stageHeader}>
        <p className={styles.pack}>{view.packTitle}</p>
        <h2>{heading}</h2>
        {view.phaseId === 'race' ? (
          <p className={styles.stageSummary}>
            {player ? L('{n} points · ', { n: view.score }) : ''}
            {view.paused ? L('Paused') : L('{n}s left', { n: seconds })}
          </p>
        ) : player && final && view.rank !== null ? (
          <p className={styles.stageSummary}>
            {L('Place {rank} · {n} points', { rank: view.rank, n: view.score })}
          </p>
        ) : null}
      </header>
      {view.phaseId === 'race' || view.phaseId === 'done' ? (
        <>
          <RaceTrack
            lanes={
              view.phaseId === 'done'
                ? [...view.lanes].sort((a, b) => b.score - a.score)
                : view.lanes
            }
            total={view.total}
            meId={view.me.id}
            compact
            ranked={view.phaseId === 'done'}
          />
        </>
      ) : (
        <Podium lanes={view.lanes} step={view.phaseId === 'done' ? 3 : view.podiumStep} compact />
      )}
      {view.phaseId !== 'done' && player && view.feedback ? (
        <p className={styles.lastAnswer}>
          <b>
            {view.feedback.correct ? L('✓ Final answer correct') : L('✗ Final answer incorrect')}
            {' · '}
            {L('+{n} pts', { n: view.feedback.points })}
          </b>
          {' · '}
          {view.feedback.answer}. {view.feedback.explanation}
        </p>
      ) : null}
      <p className={styles.stageHint}>
        {view.phaseId === 'race'
          ? L('Track = answered questions · Highest score wins')
          : final
            ? L('Same score? Same place.')
            : L('Third, second… then the winner.')}
      </p>
    </div>
  );
}
