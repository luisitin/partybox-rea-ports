import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { BigText, Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { ColourGateTvView } from '../server/index';
import { StageLane } from './StageLane';
import { clockText, colourOf, colourStyle, roster } from './presentation';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<ColourGateTvView>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const remaining = Math.max(0, view.endsAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const ticked = useRef('');
  useEffect(() => {
    const key = `${view.round}:${seconds}`;
    if (view.phaseId !== 'play' || seconds > 5 || seconds < 1 || ticked.current === key) return;
    ticked.current = key;
    sound('countdown', { quiet: true });
  }, [view.phaseId, view.round, seconds, sound]);
  const rows = roster(view);
  const ranked = [...rows].sort((a, b) => b.total - a.total);
  const leaders = ranked.filter((row) => row.total === ranked[0]?.total);
  const headline =
    view.phaseId === 'done'
      ? leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!')
      : L('Round {n} complete', { n: view.round });
  if (view.phaseId !== 'play')
    return (
      <Stage className={styles.stage}>
        <div className={styles.resultHeading}>
          <p className={styles.round}>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</p>
          <BigText level="h1">{headline}</BigText>
          <p className={styles.hint}>
            {view.phaseId === 'score'
              ? L('Every gate earns 100 points. Your best climb adds the rest.')
              : L('Final standings')}
          </p>
        </div>
        <ol className={styles.standings} aria-label={L('Players')}>
          {ranked.map((row) => (
            <li key={row.id}>
              <span className={styles.place}>
                {1 + ranked.filter((other) => other.total > row.total).length}
              </span>
              <b className={styles.resultName}>
                {row.name}
                {view.botIds.includes(row.id) ? ` · ${L('bot')}` : ''}
              </b>
              <span className={styles.gained}>{L('+{n}', { n: row.gained })}</span>
              <strong className={styles.total}>{row.total}</strong>
            </li>
          ))}
        </ol>
      </Stage>
    );
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <p className={styles.round}>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</p>
          <h1 className={styles.title}>{L('Colour Gate')}</h1>
        </div>
        <p className={styles.hint}>{L('Tap to rise. Cross your matching shape.')}</p>
        <div className={styles.clock} role="timer" data-low={seconds <= 5 || undefined}>
          <span>{L('Time left')}</span>
          <strong>{clockText(remaining)}</strong>
        </div>
      </header>
      <div
        className={styles.lanes}
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, view.world.runners.length)}, minmax(0, 1fr))`,
        }}
      >
        {view.world.runners.map((runner) => {
          const player = view.players.find((p) => p.id === runner.id);
          const colour = colourOf(runner.colour);
          return (
            <section className={styles.runner} key={runner.id}>
              <h2 className={styles.name} title={player?.name}>
                {player?.name ?? ''}
                {view.botIds.includes(runner.id) ? (
                  <span className={styles.bot}>{L('bot')}</span>
                ) : null}
              </h2>
              <p className={styles.colour}>
                <span style={colourStyle(runner.colour)}>{colour.symbol}</span> {L(colour.name)}
              </p>
              <div className={styles.lane}>
                <StageLane
                  runner={runner}
                  world={view.world}
                  elapsed={view.world.checked}
                  name={player?.name ?? ''}
                />
              </div>
              <p className={styles.progress}>{L('{n} gates', { n: runner.gates })}</p>
              <p className={styles.status}>
                {runner.respawnAt !== null
                  ? L('↻ Retry')
                  : player?.connected === false
                    ? L('Rejoining…')
                    : L('Keep climbing')}
              </p>
            </section>
          );
        })}
      </div>
    </Stage>
  );
}
