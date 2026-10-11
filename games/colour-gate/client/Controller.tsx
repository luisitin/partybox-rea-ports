import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import {
  PrimaryButton,
  Screen,
  buzz,
  usePhoneOnly,
  useServerNow,
  useSound,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { ColourGateControllerView } from '../server/index';
import type { Input } from '../server/types';
import { gateColour } from '../server/world';
import { StageLane } from './StageLane';
import { climbPoints, clockText, colourOf, colourStyle, roster } from './presentation';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<ColourGateControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const mine = view.runner;
  const playing = view.phaseId === 'play';
  const player = view.me.role === 'player' && mine !== null;
  const retrying = mine?.respawnAt !== null && mine?.respawnAt !== undefined;
  const interactive = playing && player && !retrying && !view.paused;
  const stage = phoneOnly || view.phoneStage || !player;
  const rows = roster(view);
  const ranked = [...rows].sort((a, b) => b.total - a.total);
  const focus = mine ?? [...view.world.runners].sort((a, b) => b.gates - a.gates)[0];
  const focusPlayer = view.players.find((p) => p.id === focus?.id);
  const colour = colourOf(mine?.colour ?? focus?.colour ?? 0);
  const gate = mine ? view.world.gates[mine.gates] : null;
  const target = gate ? colourOf(gateColour(gate, view.world.checked)) : null;
  const previous = useRef<{ round: number; gates: number; crashes: number } | null>(null);
  useEffect(() => {
    if (!mine) return;
    const old = previous.current;
    if (old?.round === view.round) {
      if (mine.gates > old.gates) {
        sound('correct', { quiet: true });
        buzz(20);
      } else if (mine.crashes > old.crashes) {
        sound('thud', { quiet: true });
        buzz([20, 40, 20]);
      }
    }
    previous.current = { round: view.round, gates: mine.gates, crashes: mine.crashes };
  }, [mine, view.round, sound]);
  const tap = (): void => {
    if (!interactive) return;
    send({ type: 'tap' });
    buzz(8);
  };
  const title = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : view.phaseId === 'score'
      ? L('Round {n} complete', { n: view.round })
      : L('Final standings');
  const footer =
    playing && player ? (
      <PrimaryButton
        className={styles.tap}
        repeatTaps
        disabled={!interactive}
        data-pad-primary
        aria-label={L('Tap to rise')}
        onPointerDown={(event) => {
          if (event.button === 0) {
            event.preventDefault();
            tap();
          }
        }}
        onClick={(event) => {
          if (event.detail === 0) tap();
        }}
      >
        <span className={styles.tapLabel}>{retrying ? L('↻ RETRYING') : L('TAP')}</span>
        <span className={styles.tapHint}>
          {retrying ? L('Your checkpoint is safe') : L('Rise through your matching shape')}
        </span>
      </PrimaryButton>
    ) : undefined;
  return (
    <Screen className={styles.screen} title={title} footer={footer} ghost={false}>
      <div
        className={styles.content}
        data-stage={stage || undefined}
        data-playing={playing || undefined}
      >
        {playing ? (
          <>
            <div className={styles.meta}>
              <span>
                {player
                  ? L('{n} gates · {points} points', { n: mine.gates, points: climbPoints(mine) })
                  : L('Watching {name}', { name: focusPlayer?.name ?? '' })}
              </span>
              <strong role="timer">{clockText(view.endsAt - now)}</strong>
            </div>
            {player ? (
              <div className={styles.colours}>
                <div>
                  <span className={styles.label}>{L('You')}</span>
                  <b>
                    <span style={colourStyle(mine.colour)}>{colour.symbol}</span> {L(colour.name)}{' '}
                    {L(colour.shape)}
                  </b>
                </div>
                <div>
                  <span className={styles.label}>{L('Gate now')}</span>
                  <b>
                    {target ? (
                      <>
                        <span style={colourStyle(gateColour(gate!, view.world.checked))}>
                          {target.symbol}
                        </span>{' '}
                        {L(target.name)} {L(target.shape)}
                      </>
                    ) : (
                      L('Course complete')
                    )}
                  </b>
                </div>
              </div>
            ) : null}
            {stage && focus ? (
              <div className={styles.lane}>
                <StageLane
                  runner={focus}
                  world={view.world}
                  elapsed={view.world.checked}
                  name={focusPlayer?.name ?? ''}
                />
              </div>
            ) : (
              <div className={styles.identity}>
                <span
                  className={styles.symbol}
                  style={colourStyle(mine?.colour ?? 0)}
                  aria-hidden="true"
                >
                  {colour.symbol}
                </span>
                <p>{L('Time your taps')}</p>
                <span>{L('Match at the centre of the gate')}</span>
              </div>
            )}
            <p className={styles.status} role="status">
              {retrying
                ? L('↻ Retry in {n}s · checkpoint kept', {
                    n: Math.max(1, Math.ceil(((mine?.respawnAt ?? 0) - view.world.checked) / 1000)),
                  })
                : player
                  ? L('Every tap gives one upward boost')
                  : L('Live race')}
            </p>
          </>
        ) : (
          <div className={styles.summary}>
            {player ? (
              <>
                <strong>
                  {view.phaseId === 'score'
                    ? L('+{n}', { n: view.lastPoints[view.me.id] ?? 0 })
                    : L('Place {n}', { n: view.rank ?? 1 })}
                </strong>
                <p>{L('{n} total points', { n: view.scores[view.me.id] ?? 0 })}</p>
              </>
            ) : (
              <p>
                {view.phaseId === 'score'
                  ? L('Best climb banked for everyone')
                  : L('The climb is complete')}
              </p>
            )}
          </div>
        )}
        {stage || !playing ? (
          <ul
            className={styles.roster}
            data-compact={playing || undefined}
            aria-label={L('Players')}
          >
            {(playing ? rows : ranked).map((row) => (
              <li key={row.id} data-me={row.id === view.me.id || undefined}>
                <b title={row.name}>
                  {row.name}
                  {view.botIds.includes(row.id) ? ` · ${L('bot')}` : ''}
                </b>
                <span>{playing ? L('{n} gates', { n: row.gates }) : row.total}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Screen>
  );
}
