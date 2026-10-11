// TV view for Curve Fever: the arena with every worm, the players beside it, and a labelled clock at top centre while the worms run
// (the server quiets the shell's own digits: `timerMode: 'quiet'`). Dumb component: renders `view`. Nothing is hidden from the TV.
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { BigText, Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { CurveFeverTvView } from '../server/index';
import { Arena } from './Arena';
import { STRINGS } from './strings';
import { clockText, countdown, hueOf } from './timing';
import styles from './Tv.module.css';

const hue = (slot: number): CSSProperties => ({ ['--hue' as string]: String(hueOf(slot)) });

export function Tv({ view }: GameTvProps<CurveFeverTvView>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const phase = view.phaseId;
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const msLeft = view.deadline === null ? null : Math.max(0, view.deadline - now);
  const secsLeft = msLeft === null ? 0 : Math.ceil(msLeft / 1000);
  // One tick a second while the worms wait and in the last five seconds of a round. A pause holds the clock.
  const ticked = useRef(0);
  useEffect(() => {
    const ticking = phase === 'ready' || (phase === 'play' && secsLeft <= 5);
    if (!ticking || secsLeft < 1 || secsLeft === ticked.current) return;
    ticked.current = secsLeft;
    play('countdown');
  }, [phase, secsLeft, play]);
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of view.players) out[p.id] = p.name;
    return out;
  }, [view.players]);
  const rows = view.worms.map((w, slot) => ({
    id: w.id,
    slot,
    name: names[w.id] ?? '',
    total: view.scores[w.id] ?? 0,
    gained: view.lastPoints[w.id] ?? 0,
    out: w.died !== null,
  }));
  const standings =
    phase === 'score' || phase === 'done' ? [...rows].sort((a, b) => b.total - a.total) : rows;
  const top = Math.max(0, ...rows.map((r) => r.total));
  const leaders = rows.filter((r) => r.total === top);
  let headline = '';
  if (phase === 'ready') headline = L('Round {n} of {m}', { n: view.round, m: view.rounds });
  else if (phase === 'score') headline = L('Round {n} over', { n: view.round });
  else if (phase === 'done')
    headline =
      leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
  return (
    <Stage className={styles.stage}>
      <div className={styles.board}>
        <div className={styles.arena}>
          <Arena
            worms={view.worms}
            began={view.began}
            frozen={phase !== 'play'}
            checked={view.checked}
            names={names}
            showStart={phase === 'ready'}
          />
          {phase === 'ready' && msLeft !== null ? (
            <span className={styles.count} aria-live="polite">
              {countdown(msLeft)}
            </span>
          ) : null}
        </div>
        <div className={styles.side}>
          {phase === 'play' && msLeft !== null ? (
            <div
              className={styles.clock}
              role="timer"
              data-low={secsLeft <= 5 ? 'true' : undefined}
            >
              <span className={styles.clockLabel}>{L('Time left')}</span>
              <span className={styles.clockValue}>{clockText(msLeft)}</span>
            </div>
          ) : (
            <BigText level="h1">{headline}</BigText>
          )}
          <ul className={styles.rows} aria-label={L('Players')}>
            {standings.map((r) => (
              <li
                key={r.id}
                style={hue(r.slot)}
                data-out={phase === 'play' && r.out ? 'true' : undefined}
              >
                <i className={styles.dot} aria-hidden="true" />
                <b className={styles.name}>{r.name}</b>
                {phase === 'score' && r.gained > 0 ? (
                  <span className={styles.gain}>{`+${r.gained}`}</span>
                ) : null}
                <span className={styles.points}>{r.total}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Stage>
  );
}
