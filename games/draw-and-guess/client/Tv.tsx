// The drawing is the focal point; solved checks and the clock keep the room in the race.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { DrawGuessTvView } from '../server/index';
import { Board } from './Board';
import { standings } from './standings';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<DrawGuessTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const seconds =
    view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const ranked = view.phaseId === 'reveal' || view.phaseId === 'done';
  const rows = standings(view, ranked);
  const leaders = rows.filter((row) => row.rank === 1);
  const title =
    view.phaseId === 'done'
      ? leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!')
      : view.phaseId === 'choose'
        ? L('{name} is choosing a word', { name: view.drawerName })
        : view.phaseId === 'reveal'
          ? L('The word was…')
          : L('{name} is drawing', { name: view.drawerName });

  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.turn}>{L('Turn {n} of {m}', { n: view.turn, m: view.turns })}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        {seconds !== null && view.phaseId !== 'done' ? (
          <div className={styles.clock} role="timer" data-low={seconds <= 5 || undefined}>
            <span>{view.paused ? L('Paused') : L('Time left')}</span>
            <b>{seconds}</b>
          </div>
        ) : null}
      </header>
      <div className={styles.layout}>
        <div className={styles.focal}>
          <div className={styles.word} aria-live="polite">
            {view.phaseId === 'choose'
              ? L('Three words. One choice.')
              : view.answer !== null
                ? view.answer
                : view.mask}
          </div>
          <div className={styles.paper}>
            <Board strokes={view.strokes} label={L('Live drawing')} />
            {view.strokes.length === 0 ? (
              <div className={styles.empty}>
                <span aria-hidden="true">✎</span>
                <p>
                  {view.phaseId === 'choose'
                    ? L('A fresh canvas is waiting')
                    : view.phaseId === 'done'
                      ? L('The final standings are in')
                      : view.phaseId === 'reveal'
                        ? L('This word stayed a mystery')
                        : L('Watch the first line appear')}
                </p>
              </div>
            ) : null}
          </div>
          <p className={styles.instruction}>
            {view.phaseId === 'choose'
              ? L('The artist picks on their phone. Everyone else gets ready to guess.')
              : view.phaseId === 'draw'
                ? L('Type guesses on your phone. Faster correct guesses score more.')
                : view.phaseId === 'reveal'
                  ? L('{n} guessed it · points added', { n: view.solvedIds.length })
                  : L('Every drawing brought the room together.')}
          </p>
        </div>
        <aside className={styles.rail}>
          <h3>{ranked ? L('Standings') : L('The room')}</h3>
          <ul className={styles.rows} aria-label={L('Players')}>
            {rows.map((row) => (
              <li key={row.id} data-solved={row.solved || undefined}>
                <span className={styles.mark} aria-hidden="true">
                  {ranked ? row.rank : row.drawer ? '✎' : row.solved ? '✓' : '·'}
                </span>
                <div className={styles.player}>
                  <b>{row.name}</b>
                  <span>
                    {view.phaseId === 'done'
                      ? row.rank === 1
                        ? leaders.length === 1
                          ? L('Winner')
                          : L('Tied for first')
                        : L('Place {rank}', { rank: row.rank })
                      : row.drawer
                        ? L('Artist')
                        : row.solved
                          ? L('Guessed it')
                          : ranked
                            ? L('Next time!')
                            : L('Guessing')}
                  </span>
                </div>
                <div className={styles.score}>
                  <b>{row.score}</b>
                  {ranked && row.gain > 0 ? <span>+{row.gain}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Stage>
  );
}
