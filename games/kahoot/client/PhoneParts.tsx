import type { JSX } from 'react';
import { Avatar, useT } from '@partybox/game-sdk/ui';
import type { Verdict } from '../server/types';
import type { Standing } from '../server/views';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function VerdictCard({
  verdict,
  rank,
  compact = false,
}: {
  verdict: Verdict;
  rank: number;
  compact?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const correct = verdict.outcome === 'correct';
  return (
    <div
      className={styles.verdict}
      data-outcome={verdict.outcome}
      data-compact={compact || undefined}
      role="status"
    >
      <span className={styles.verdictMark} aria-hidden="true">
        {correct ? '✓' : verdict.outcome === 'timeout' ? '◷' : '×'}
      </span>
      <h3>
        {correct
          ? L('Correct!')
          : verdict.outcome === 'timeout'
            ? L('Too slow')
            : L('Not this time')}
      </h3>
      <b className={styles.points}>{L('+{n} points', { n: verdict.points })}</b>
      {correct ? (
        <p>
          {L('{n} speed points', { n: verdict.base })}
          {verdict.bonus > 0 ? ` · ${L('+{n} streak bonus', { n: verdict.bonus })}` : ''}
        </p>
      ) : null}
      <p>
        {rank > 0 ? L('Place {rank}', { rank }) : L('Podium reveal')}
        {correct ? ` · ${L('{n} correct in a row', { n: verdict.streak })}` : ''}
      </p>
    </div>
  );
}

export function PhoneStandings({
  standings,
  meId,
}: {
  standings: readonly Standing[];
  meId: string;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol className={styles.standings} aria-label={L('Scoreboard')}>
      {standings.map((p) => (
        <li key={p.id} data-me={p.id === meId || undefined}>
          <span className={styles.rank}>{p.rank}</span>
          <Avatar avatarId={p.avatarId} size="var(--pb-chip-size)" />
          <b className={styles.playerName}>{p.name}</b>
          <span className={styles.total}>{p.score}</span>
        </li>
      ))}
    </ol>
  );
}
