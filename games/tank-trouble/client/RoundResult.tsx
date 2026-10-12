// A brief public result and a private rank receipt; the finale carries the full standings.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { TankTroubleTvView } from '../server/index';
import { STRINGS } from './strings';
import styles from './RoundResult.module.css';

export function RoundResult({
  view,
  seconds,
  me,
}: {
  view: TankTroubleTvView;
  seconds: number;
  me?: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const winner = view.players.find((player) => player.id === view.winnerIds[0]);
  const won = winner && (view.lastPoints[winner.id] ?? 0) > 0;
  const mine = me ? (view.scores[me] ?? 0) : 0;
  const rank = 1 + Object.values(view.scores).filter((score) => score > mine).length;
  return (
    <div className={styles.result}>
      <h2>{L('Round {n}', { n: view.round })}</h2>
      <p className={styles.winner}>
        {won
          ? L('{name} wins', { name: winner.name })
          : view.reason === 'time'
            ? L('Time up')
            : view.reason === 'skip'
              ? L('Round skipped')
              : L('No survivors')}
      </p>
      {won ? (
        <>
          <b className={styles.gain}>+1</b>
          <p>{L('{n} total wins', { n: view.scores[winner.id] ?? 0 })}</p>
        </>
      ) : (
        <p>{L('No round points')}</p>
      )}
      {me ? (
        <div className={styles.receipt} aria-label={L('Your round result')}>
          <b>{L('Your rank #{n}', { n: rank })}</b>
          <span>{L('{n} wins', { n: mine })}</span>
          <span>{L('+{n} this round', { n: view.lastPoints[me] ?? 0 })}</span>
        </div>
      ) : null}
      <div className={styles.next}>
        <span>
          {view.paused ? L('Paused') : view.round >= view.rounds ? L('Results') : L('Next')}
        </span>
        <b role="timer">{Math.max(0, seconds)}s</b>
      </div>
    </div>
  );
}
