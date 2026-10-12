// One focal arena, numbered live sizes and a couch-readable round clock.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { SnakeTvView } from '../server/index';
import { Arena } from './Arena';
import { Standings } from './Standings';
import { standingsRows } from './standingsRows';
import { STRINGS } from './strings';
import { clockText } from './timing';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<SnakeTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const finalRound = view.round >= view.rounds;
  const rows = standingsRows(view, !playing);
  const leaders = rows.filter((row) => row.total === (rows[0]?.total ?? 0));
  const headline = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : view.phaseId === 'score'
      ? L('Round {n} banked!', { n: view.round })
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
  const msLeft = Math.max(0, (playing ? view.endsAt : (view.deadline ?? now)) - now);
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} title={headline}>
            {headline}
          </h1>
          <p className={styles.hint}>
            {playing
              ? L('Eat sparks. Cut off rivals. Size at the buzzer scores.')
              : view.phaseId === 'score'
                ? finalRound
                  ? L('End size added to match points. Final results coming up.')
                  : L('End size added to match points. Get ready to grow again.')
                : L('Most match points wins.')}
          </p>
        </div>
        {view.phaseId !== 'done' ? (
          <div
            className={styles.clock}
            data-low={(playing && msLeft <= 5000) || undefined}
            role="timer"
          >
            <span>
              {playing ? L('Time left') : finalRound ? L('Final results') : L('Next round')}
            </span>
            <b>{clockText(msLeft)}</b>
          </div>
        ) : null}
      </header>
      <div className={styles.board}>
        <div className={styles.arena}>
          <Arena
            world={view.world}
            names={new Map(view.players.map((player) => [player.id, player.name]))}
          />
        </div>
        <aside className={styles.side}>
          <h2 className={styles.railTitle}>{playing ? L('Current size') : L('Match points')}</h2>
          <Standings rows={rows} phase={view.phaseId} />
        </aside>
      </div>
      <p className={styles.legend}>
        {L('● Sparks grow you · ◆ Crash food is richer · Dashed ring = shield · Walls are lethal')}
      </p>
    </Stage>
  );
}
