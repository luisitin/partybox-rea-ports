// Immediate taps consume only the four disclosed notes; acknowledgements reconcile the cursor.
import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { TileTempoControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Standings } from './Standings';
import { STRINGS } from './strings';
import { TileGrid } from './TileGrid';
import { clockText, secondsLeft } from './timing';
import { predictPending, queueTap, reconcilePending } from './pending';
import type { PendingCursor, PendingSource } from './pending';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<TileTempoControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly() || view.phoneStage;
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playSound = useSound();
  const phase = view.phaseId;
  const player = view.me.role === 'player';
  const playing = phase === 'play' && player && view.alive;
  const remaining = secondsLeft(view.deadline, now);
  const mine = view.standings.find((p) => p.id === view.me.id);
  const source: PendingSource = {
    phase,
    began: view.began,
    row: view.row,
    notes: view.notes,
    player,
    alive: view.alive,
    paused: view.paused,
    connected: mine?.connected ?? false,
    now,
  };
  const [storedPending, setPending] = useState<PendingCursor>({ key: '', taps: [] });
  const pending = reconcilePending(storedPending, source);
  if (pending !== storedPending) setPending(pending);
  const pendingRef = useRef(pending);
  const sourceRef = useRef(source);
  pendingRef.current = pending;
  sourceRef.current = source;
  const predicted = predictPending(pending, source);
  const enabled = predicted.enabled && now < view.endsAt;

  const tap = (column: number, renderedRow: number): void => {
    if (sourceRef.current.now >= view.endsAt) return;
    const accepted = queueTap(pendingRef.current, sourceRef.current, column, renderedRow);
    if (!accepted) return;
    pendingRef.current = accepted.pending;
    setPending(accepted.pending);
    playSound(accepted.wrong ? 'error' : 'clack', { quiet: true, gain: 0.5 });
    buzz(accepted.wrong ? 120 : 10);
    send(accepted.input);
  };

  const final = phase === 'score' || phase === 'done';
  const leaders = view.standings.filter((p) => p.rank === 1);
  let headline = L('Tile Tempo');
  let message = L('Tap the ♪ in the bottom row.');
  if (phase === 'ready') message = L('Tap ♪. One wrong tap ends your run.');
  else if (!player && phase === 'play') {
    headline = L('Watch the race');
    message = L('Most tiles in 30 seconds wins.');
  } else if (phase === 'play' && (!view.alive || predicted.out)) {
    headline = L('Your run is over');
    message =
      view.wrongColumn === null && !predicted.out
        ? L('Your tiles still count. Follow the race below.')
        : L('Wrong tile. Your tiles still count.');
  } else if (final) {
    headline =
      leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
    message = player
      ? L('Place {rank} · {tiles} tiles', { rank: view.rank ?? '—', tiles: mine?.tiles ?? 0 })
      : L('Final standings');
  }

  const showGrid = player && (phase === 'ready' || (playing && !predicted.out));
  const showStandings = phoneOnly || !showGrid;
  return (
    <section
      className={styles.screen}
      data-grid={showGrid ? 'true' : undefined}
      data-stage={showStandings ? 'true' : undefined}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{L('30-second tile race')}</p>
          <h2 className={styles.headline}>{headline}</h2>
        </div>
        {(phase === 'ready' || phase === 'play') && (
          <div
            className={styles.clock}
            role="timer"
            aria-label={phase === 'ready' ? L('Starts in') : L('Time left')}
          >
            <span className={styles.clockLabel}>
              {phase === 'ready' ? L('Starts in') : L('Time left')}
            </span>
            <strong>{phase === 'ready' ? remaining : clockText(remaining)}</strong>
          </div>
        )}
      </header>
      {player && (
        <p className={styles.stats}>
          <span>
            <b>{(mine?.tiles ?? 0) + predicted.unconfirmed}</b> {L('tiles')}
          </span>
          <span>
            <b>{(mine?.speed ?? 0).toFixed(1)}</b> {L('tiles/s')}
          </span>
        </p>
      )}
      <p className={styles.hint} role="status">
        {view.paused ? L('Paused · your row is held') : message}
      </p>
      {showStandings && <Standings rows={view.standings} me={view.me.id} phase={phase} />}
      {showGrid && (
        <TileGrid notes={predicted.notes} row={predicted.row} enabled={enabled} tap={tap} />
      )}
      {showGrid && (
        <p className={styles.footnote}>
          {phase === 'ready'
            ? L('Start when the clock says 0:30')
            : predicted.notes[0] === null
              ? L('Waiting for the next tiles…')
              : L('♪ Tap here · bottom row only')}
        </p>
      )}
    </section>
  );
}
