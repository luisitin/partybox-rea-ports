// Powers are explicit server inputs. The picker lists only rivals who can currently be frozen.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { TriviaControllerView } from '../server/index';
import type { Input } from '../server/types';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function PowerBar({
  view,
  send,
  disabled,
  now,
}: {
  view: TriviaControllerView;
  send: (input: Input) => void;
  disabled: boolean;
  now: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const [selected, select] = useState('');
  const [pending, setPending] = useState<{
    phaseAt: number;
    charge: number;
    power: 'freeze' | 'double';
    target?: string;
    energy: number;
    at: number;
    confirmedAt?: number;
  } | null>(null);
  const targets = view.lanes
    .filter((lane) => lane.id !== view.me.id && lane.connected && !lane.finished && !lane.frozen)
    .sort((a, b) => b.score - a.score);
  const validSelection = targets.some((lane) => lane.id === selected);
  if (selected && !validSelection) select('');
  const target = targets.find((lane) => lane.id === selected) ?? targets[0];
  const rankOf = (score: number): number =>
    1 + view.lanes.filter((lane) => lane.score > score).length;
  const charge = Math.floor(view.correct / 3);
  const current = pending?.phaseAt === view.phaseAt && pending.charge === charge;
  const confirmed = current && view.energy < pending.energy;
  const waiting = current && !confirmed && now - pending.at < 4000;
  const retry = current && !confirmed && !waiting;
  const showConfirmed = confirmed && now - (pending.confirmedAt ?? now) < 4000;
  const rivalFrozen =
    confirmed &&
    pending.power === 'freeze' &&
    view.lanes.some((lane) => lane.id === pending.target && lane.frozen);
  useEffect(() => {
    if (confirmed && pending.confirmedAt === undefined)
      setPending({ ...pending, confirmedAt: now });
  }, [confirmed, pending, now]);
  const empty = disabled || view.energy < 1 || waiting;
  const request = (power: 'freeze' | 'double', rival?: string): void => {
    setPending({
      phaseAt: view.phaseAt,
      charge,
      power,
      ...(rival ? { target: rival } : {}),
      energy: view.energy,
      at: now,
    });
    send({ type: 'power', power, charge, ...(rival ? { target: rival } : {}) });
  };
  return (
    <section className={styles.powers} aria-label={L('Power-ups')}>
      <p className={styles.energy} role="status">
        <b>
          {waiting
            ? L('Sending power…')
            : retry
              ? L('Power not confirmed — tap again')
              : showConfirmed
                ? L('Power used')
                : view.energy > 0
                  ? L('⚡ Power ready')
                  : L('⚡ Earn a power every 3 correct')}
        </b>
        {view.double ? (
          <span>{L('×2 armed')}</span>
        ) : showConfirmed && rivalFrozen ? (
          <span>{L('❄ Rival frozen')}</span>
        ) : null}
      </p>
      <div className={styles.powerControls}>
        <button
          type="button"
          className={styles.powerButton}
          disabled={empty || view.double}
          onClick={() => request('double')}
        >
          <strong>{L('×2 Next correct')}</strong>
        </button>
        <button
          type="button"
          className={styles.powerButton}
          disabled={empty || !target}
          onClick={() => {
            if (target) request('freeze', target.id);
          }}
        >
          <strong>{L('❄ Freeze 3s')}</strong>
        </button>
        <select
          className={styles.target}
          aria-label={L('Rival to freeze')}
          title={
            target
              ? L('{name} · Place {rank} · {score} points', {
                  name: target.name,
                  rank: rankOf(target.score),
                  score: target.score,
                })
              : undefined
          }
          disabled={empty || !target}
          value={target?.id ?? ''}
          onChange={(event) => select(event.currentTarget.value)}
        >
          {targets.length === 0 ? <option value="">{L('No rival available')}</option> : null}
          {targets.map((lane) => (
            <option value={lane.id} key={lane.id}>
              {L('{rank} · {score} pts · {name}', {
                rank: rankOf(lane.score),
                score: lane.score,
                name: lane.name,
              })}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
