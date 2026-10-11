import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { DrawTvView } from '../server/types';
import { Pencil, Picture } from './Picture';
import { leaderNames, Roster } from './Roster';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<DrawTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const seconds = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const phase = view.phaseId;
  const leaders = leaderNames(view, view.players);
  const title =
    phase === 'choose'
      ? L('A secret word is coming…')
      : phase === 'draw'
        ? view.mask
        : phase === 'reveal'
          ? (view.answer ?? '')
          : leaders.length === 1
            ? L('{name} wins!', { name: leaders[0] ?? '' })
            : L('A tie at the top!');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {phase === 'reveal'
              ? L('The word was')
              : phase === 'done'
                ? L('Drawing champions')
                : L('Turn {n} of {m}', { n: view.turn, m: view.turns })}
          </p>
          <h1 className={styles.title} data-mask={phase === 'draw'}>
            {title}
          </h1>
        </div>
        {phase === 'choose' || phase === 'draw' ? (
          <div
            className={styles.clock}
            role="timer"
            aria-label={L('Time left')}
            data-low={seconds <= 5}
          >
            <span>{view.paused ? L('Paused') : L('Time left')}</span>
            <b>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </b>
          </div>
        ) : null}
      </header>
      <div className={styles.layout}>
        <div className={styles.paper}>
          <Picture strokes={view.strokes} />
          {phase === 'choose' ? (
            <div className={styles.cover}>
              <Pencil />
              <h2>{L('{name} is choosing', { name: view.drawerName })}</h2>
              <p>{L('The artist has three words on their phone.')}</p>
            </div>
          ) : phase === 'draw' && view.strokes.length === 0 ? (
            <p className={styles.empty}>{L('First strokes coming…')}</p>
          ) : null}
        </div>
        <aside className={styles.side}>
          {phase !== 'done' ? (
            <p className={styles.artist}>{L('Artist: {name}', { name: view.drawerName })}</p>
          ) : null}
          <p className={styles.solvers}>
            {L('{n} of {m} guessed it', { n: view.solvedCount, m: view.guesserCount })}
          </p>
          <Roster
            board={view}
            players={view.players}
            ranked={phase === 'reveal' || phase === 'done'}
            gains={phase === 'reveal'}
          />
          {phase === 'draw' ? (
            <p className={styles.rule}>
              {L('Type guesses on your phone. Quick guesses score more.')}
            </p>
          ) : null}
        </aside>
      </div>
    </Stage>
  );
}
