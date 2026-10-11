// Powers are explicit server inputs. The picker lists only rivals who can currently be frozen.
import { useState } from 'react';
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
}: {
  view: TriviaControllerView;
  send: (input: Input) => void;
  disabled: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const [selected, select] = useState('');
  const targets = view.lanes.filter(
    (lane) => lane.id !== view.me.id && lane.connected && !lane.finished && !lane.frozen,
  );
  const target = targets.some((lane) => lane.id === selected) ? selected : (targets[0]?.id ?? '');
  const empty = disabled || view.energy < 1;
  return (
    <section className={styles.powers} aria-label={L('Power-ups')}>
      <p className={styles.energy}>
        <b>{view.energy > 0 ? L('⚡ Power ready') : L('⚡ Earn a power every 3 correct')}</b>
        {view.double ? <span>{L('×2 armed')}</span> : null}
      </p>
      <div className={styles.powerControls}>
        <button
          type="button"
          className={styles.powerButton}
          disabled={empty || view.double}
          onClick={() => send({ type: 'power', power: 'double' })}
        >
          <strong>{L('×2 Points')}</strong>
          <span>{view.double ? L('Next correct is doubled') : L('Double next correct')}</span>
        </button>
        <div className={styles.freezePower}>
          <button
            type="button"
            className={styles.powerButton}
            disabled={empty || !target}
            onClick={() => send({ type: 'power', power: 'freeze', target })}
          >
            <strong>{L('❄ Freeze 3s')}</strong>
          </button>
          <select
            className={styles.target}
            aria-label={L('Rival to freeze')}
            disabled={empty || !target}
            value={target}
            onChange={(event) => select(event.currentTarget.value)}
          >
            {targets.length === 0 ? <option value="">{L('No rival available')}</option> : null}
            {targets.map((lane) => (
              <option value={lane.id} key={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
