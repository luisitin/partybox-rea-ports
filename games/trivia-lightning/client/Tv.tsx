// The public stage tracks racers, then reveals third, second and first. Questions stay on phones.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { TriviaTvView } from '../server/index';
import { Podium } from './Podium';
import { RaceTrack } from './RaceTrack';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<TriviaTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const seconds = view.deadline === null ? 0 : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const top = Math.max(0, ...view.lanes.map((lane) => lane.score));
  const winners = view.lanes.filter((lane) => lane.score === top);
  const shown = view.phaseId === 'done' || view.podiumStep >= 3;
  const heading =
    view.phaseId === 'race'
      ? L('Trivia Lightning')
      : !shown
        ? L('The podium')
        : winners.length > 1
          ? L('Shared first place!')
          : L('{name} wins!', { name: winners[0]?.name ?? '' });
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <p className={styles.pack}>{view.packTitle}</p>
          <h1>{heading}</h1>
        </div>
        {view.phaseId === 'race' ? (
          <div className={styles.clock} role="timer" aria-label={L('Race time left')}>
            <span>{view.paused ? L('Paused') : L('Time left')}</span>
            <strong data-low={seconds <= 5 || undefined}>
              {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
            </strong>
          </div>
        ) : null}
      </header>
      {view.phaseId === 'race' || view.phaseId === 'done' ? (
        <RaceTrack
          lanes={
            view.phaseId === 'done' ? [...view.lanes].sort((a, b) => b.score - a.score) : view.lanes
          }
          total={view.total}
          ranked={view.phaseId === 'done'}
        />
      ) : (
        <Podium lanes={view.lanes} step={view.phaseId === 'done' ? 3 : view.podiumStep} />
      )}
      <p className={styles.footer}>
        {view.phaseId === 'race'
          ? L('Answer on your phone · {total} questions · Highest score wins', {
              total: view.total,
            })
          : shown
            ? L('Same score? Same place. Every correct answer counted.')
            : L('The race is over. Who made the top three?')}
      </p>
    </Stage>
  );
}
