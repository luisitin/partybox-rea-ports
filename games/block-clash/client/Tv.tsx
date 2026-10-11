// One shared stage: each named well stays in the same slot, so attacks remain easy to follow.
import type { CSSProperties, JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { BlockClashTvView } from '../server/index';
import { Board } from './Board';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<BlockClashTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const seconds = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  const names = new Map(view.boards.map((b) => [b.id, b.name]));
  const leaders = view.standings.filter((p) => p.rank === 1);
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h2>{view.phaseId === 'play' ? L('Block Clash') : L('Match complete')}</h2>
          <p>
            {view.phaseId === 'play'
              ? L('Clear lines. Send trouble. Stay standing.')
              : leaders.length === 1
                ? `${leaders[0]?.name} wins!`
                : L('A tie at the top!')}
          </p>
        </div>
        {view.phaseId === 'play' && (
          <div className={styles.clock} role="timer" aria-label={L('Time left')}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </div>
        )}
      </header>
      {view.phaseId === 'play' ? (
        <div className={styles.boards} style={{ '--boards': view.boards.length } as CSSProperties}>
          {view.boards.map((board, slot) => (
            <section
              key={board.id}
              className={styles.well}
              style={{ '--player': `var(--pb-player-${slot + 1})` } as CSSProperties}
            >
              <h3 title={board.name}>{board.name}</h3>
              <div className={styles.picture}>
                <Board board={board} />
              </div>
              <div className={styles.stats}>
                <b>
                  {board.score} <span>{L('pts')}</span>
                </b>
                <p>
                  {board.pending
                    ? `${board.pending} ${L('incoming rows')}`
                    : `${board.lines} ${L('lines')}`}
                </p>
                <p>
                  {board.alive
                    ? `→ ${names.get(board.target ?? '') ?? L('No rival')}`
                    : L('Out of play')}
                </p>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ol className={styles.standings}>
          {view.standings.map((row) => (
            <li key={row.id}>
              <b>
                {row.rank}. {row.name}
              </b>
              <span>
                {row.score} {L('pts')} · {row.lines} {L('lines')}
              </span>
              <small>{row.alive ? L('Survived') : L('Eliminated')}</small>
            </li>
          ))}
        </ol>
      )}
    </Stage>
  );
}
