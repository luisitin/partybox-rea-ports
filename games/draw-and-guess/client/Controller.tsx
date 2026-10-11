// Every role has one clear action. Remote players and spectators carry the public stage with them.
import type { CSSProperties, JSX } from 'react';
import { Screen, usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { DrawGuessControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Board } from './Board';
import { DrawingPad } from './DrawingPad';
import { GuessForm } from './GuessForm';
import { standings } from './standings';
import { STRINGS } from './strings';
import { useKeyboardInset } from './useKeyboardInset';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<DrawGuessControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const stage = phoneOnly || view.stage || view.me.role === 'spectator';
  const player = view.me.role === 'player';
  const inset = useKeyboardInset();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const seconds =
    view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const rows = standings(view, true);
  const leaders = rows.filter((row) => row.rank === 1);
  const heading =
    view.phaseId === 'choose'
      ? view.isDrawer && player
        ? L('Choose your word')
        : L('{name} is choosing', { name: view.drawerName })
      : view.phaseId === 'draw'
        ? view.isDrawer && player
          ? L('You are the artist')
          : view.solved
            ? L('You guessed it!')
            : L('{name} is drawing', { name: view.drawerName })
        : view.phaseId === 'reveal'
          ? L('The word was…')
          : leaders.length === 1
            ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
            : L('A tie at the top!');
  const reveal = view.phaseId === 'reveal' || view.phaseId === 'done';
  return (
    <Screen
      className={styles.screen}
      ghost={false}
      style={{ ['--keyboard-inset' as string]: `${inset}px` } as CSSProperties}
    >
      <div className={styles.content} data-keyboard={inset > 0 || undefined}>
        <header className={styles.header}>
          <div className={styles.headline}>
            <p>{L('Turn {n} of {m}', { n: view.turn, m: view.turns })}</p>
            <h2>{heading}</h2>
          </div>
          {seconds !== null && !reveal ? (
            <b className={styles.clock} role="timer">
              {view.paused ? L('Paused') : seconds}
            </b>
          ) : null}
        </header>
        {view.phaseId === 'choose' && player && view.isDrawer ? (
          <div className={styles.choose}>
            <p className={styles.hint}>{L('Pick something you can draw. Keep it secret!')}</p>
            <div className={styles.choices}>
              {view.choices.map((choice, index) => (
                <button
                  key={choice}
                  type="button"
                  disabled={!!view.paused}
                  onClick={() => send({ type: 'choose', index })}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  <b>{choice}</b>
                </button>
              ))}
            </div>
            <p className={styles.hint}>
              {L('If time runs out, the first word is chosen for you.')}
            </p>
          </div>
        ) : view.phaseId === 'draw' && player && view.isDrawer ? (
          <DrawingPad key={view.turn} view={view} send={send} />
        ) : reveal ? (
          <div className={styles.reveal}>
            <p className={styles.answer}>{view.answer ?? ''}</p>
            <p className={styles.summary}>
              {player
                ? view.phaseId === 'done'
                  ? L('Place {rank} · {n} points', {
                      rank: view.rank ?? 1,
                      n: view.scores[view.me.id] ?? 0,
                    })
                  : L('+{n} this turn · {m} points total', {
                      n: view.lastPoints[view.me.id] ?? 0,
                      m: view.scores[view.me.id] ?? 0,
                    })
                : L('{n} guessed it', { n: view.solvedIds.length })}
            </p>
            {stage ? (
              <div className={styles.revealPaper}>
                <Board strokes={view.strokes} label={L('The finished drawing')} />
              </div>
            ) : null}
            <ul className={styles.rows} aria-label={L('Standings')}>
              {rows.map((row) => (
                <li key={row.id} data-me={(player && row.id === view.me.id) || undefined}>
                  <span className={styles.rank}>{row.rank}</span>
                  <b className={styles.name}>{row.name}</b>
                  {row.gain > 0 ? <span className={styles.gain}>+{row.gain}</span> : null}
                  <b>{row.score}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={styles.watching}>
            {view.phaseId === 'draw' ? (
              <p className={styles.mask} aria-live="polite">
                {view.mask}
              </p>
            ) : null}
            {stage ? (
              <div className={styles.stagePaper}>
                <Board strokes={view.strokes} label={L('Live drawing')} />
              </div>
            ) : null}
            {view.phaseId === 'draw' && player ? (
              <GuessForm key={view.turn} view={view} send={send} />
            ) : (
              <div className={styles.waiting}>
                <span aria-hidden="true">✎</span>
                <p className={styles.hint}>
                  {view.phaseId === 'choose'
                    ? L('Get ready to guess the first line.')
                    : L('{n} guessed it. Watch the picture grow!', { n: view.solvedIds.length })}
                </p>
              </div>
            )}
            {!stage && view.phaseId === 'draw' ? (
              <p className={styles.note}>{L('The drawing is on the TV.')}</p>
            ) : null}
          </div>
        )}
      </div>
    </Screen>
  );
}
