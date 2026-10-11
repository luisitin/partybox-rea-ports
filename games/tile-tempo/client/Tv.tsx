// The stage reveals tile totals and speed without exposing anybody's upcoming notes.
import { useEffect, useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Avatar, Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { TileTempoTvView } from '../server/index';
import { STRINGS } from './strings';
import { clockText, secondsLeft } from './timing';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<TileTempoTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const sound = useSound();
  const phase = view.phaseId;
  const seconds = secondsLeft(view.deadline, now);
  const ticked = useRef('');
  useEffect(() => {
    const key = `${phase}:${view.began}:${seconds}`;
    if (view.paused || seconds < 1 || ticked.current === key) return;
    if (phase === 'ready' || (phase === 'play' && seconds <= 5)) {
      ticked.current = key;
      sound('countdown');
    }
  }, [phase, seconds, view.began, view.paused, sound]);
  const final = phase === 'score' || phase === 'done';
  const leaders = view.standings.filter((p) => p.rank === 1);
  const top = Math.max(1, ...view.standings.map((p) => p.tiles));
  const alive = view.standings.filter((p) => p.connected && !p.out).length;
  const standings = final ? [...view.standings].sort((a, b) => a.rank - b.rank) : view.standings;
  const headline = final
    ? leaders.length === 1
      ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
      : L('A tie at the top!')
    : L('Tile Tempo');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <p className={styles.kicker}>{L('30-second tile race')}</p>
          <h2 className={styles.headline}>{headline}</h2>
          <p className={styles.instructions}>
            {final
              ? L('Most tiles wins · equal counts share a place')
              : L('Tap the ♪ in the bottom row. A wrong tap ends your run.')}
          </p>
        </div>
        {!final && (
          <div
            className={styles.clock}
            role="timer"
            data-low={phase === 'play' && seconds <= 5 ? 'true' : undefined}
          >
            <span>
              {view.paused ? L('Paused') : phase === 'ready' ? L('Starts in') : L('Time left')}
            </span>
            <strong>{phase === 'ready' ? seconds : clockText(seconds)}</strong>
          </div>
        )}
      </header>
      <ol className={styles.racers} aria-label={L('Standings')}>
        {standings.map((p) => {
          const slot = Math.max(
            0,
            view.players.findIndex((player) => player.id === p.id),
          );
          const progress: CSSProperties = {
            ['--player-color' as string]: `var(--pb-player-${(slot % 8) + 1})`,
            ['--progress' as string]: String(p.tiles / top),
          };
          return (
            <li
              key={p.id}
              style={progress}
              data-leader={p.rank === 1 && p.tiles > 0 ? 'true' : undefined}
              data-out={p.out ? 'true' : undefined}
            >
              <div className={styles.rowHead}>
                <span className={styles.rank}>{p.rank}</span>
                <Avatar avatarId={p.avatarId} size="var(--pb-space-7)" />
                <b className={styles.name} title={p.name}>
                  {p.name}
                </b>
                <strong className={styles.count}>{p.tiles}</strong>
                <span>{L('tiles')}</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <span />
              </div>
              <div className={styles.rowFoot}>
                <span className={styles.status}>
                  {final
                    ? L('Finished')
                    : !p.connected
                      ? L('Disconnected')
                      : p.out
                        ? L('Out · wrong tile')
                        : phase === 'ready'
                          ? L('Ready')
                          : L('Playing')}
                </span>
                <span className={styles.speed}>
                  {L('{speed} tiles/s', { speed: p.speed.toFixed(1) })}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.footer}>
        {final
          ? L('Final standings')
          : phase === 'ready'
            ? L('Same tile sequence for everyone')
            : L('{count} still playing', { count: alive })}
      </p>
    </Stage>
  );
}
