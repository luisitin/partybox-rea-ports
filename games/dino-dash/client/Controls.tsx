import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent } from 'react';
import { buzz, useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/world';
import styles from './Controller.module.css';
import { STRINGS } from './strings';

/** Each finger/key owns its hold: releasing one finger never cancels another finger. */
export function Controls({ send }: { send: (input: Input) => void }): JSX.Element {
  const L = useT(STRINGS);
  const sources = useRef(new Set<string>());
  const sent = useRef(false);
  const sender = useRef(send);
  const duckButton = useRef<HTMLButtonElement>(null);
  const [duck, setDuck] = useState(false);
  sender.current = send;
  const sync = (): void => {
    const down = sources.current.size > 0;
    setDuck(down);
    if (sent.current === down) return;
    sent.current = down;
    sender.current({ type: 'duck', down });
  };
  const hold = (source: string, down: boolean): void => {
    if (down) sources.current.add(source);
    else sources.current.delete(source);
    sync();
  };
  const jump = (): void => {
    buzz(8);
    sender.current({ type: 'jump' });
  };
  useEffect(() => {
    const release = (): void => {
      sources.current.clear();
      if (sent.current) sender.current({ type: 'duck', down: false });
      sent.current = false;
      setDuck(false);
    };
    const keyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const duckKey =
        event.key === 'ArrowDown' ||
        (target === duckButton.current && (event.key === ' ' || event.key === 'Enter'));
      if (duckKey) {
        event.preventDefault();
        hold(`key:${event.key}`, true);
      } else if (event.key === 'ArrowUp' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) jump();
      }
    };
    const keyUp = (event: KeyboardEvent): void => {
      if (sources.current.has(`key:${event.key}`)) {
        event.preventDefault();
        hold(`key:${event.key}`, false);
      }
    };
    const visibility = (): void => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
      sources.current.clear();
      if (sent.current) sender.current({ type: 'duck', down: false });
      sent.current = false;
    };
    // The handlers use current refs, so a 100ms server push does not interrupt a finger's hold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pointerHold = (event: PointerEvent<HTMLButtonElement>, down: boolean): void => {
    event.preventDefault();
    if (down) {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      buzz(8);
    }
    hold(`pointer:${event.pointerId}`, down);
  };
  return (
    <div className={styles.controls} role="group" aria-label={L('Run controls')}>
      <button
        type="button"
        className={styles.jump}
        aria-label={L('Jump over a rock')}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          jump();
        }}
        onClick={(event) => {
          if (event.detail === 0) jump();
        }}
      >
        <span className={styles.arrow} aria-hidden="true">
          ↑
        </span>
        <b>{L('JUMP')}</b>
        <span>{L('Tap')}</span>
      </button>
      <button
        ref={duckButton}
        type="button"
        className={styles.duck}
        aria-label={L('Hold to duck under a bird')}
        aria-pressed={duck}
        data-held={duck ? 'true' : undefined}
        onPointerDown={(event) => pointerHold(event, true)}
        onPointerUp={(event) => pointerHold(event, false)}
        onPointerCancel={(event) => pointerHold(event, false)}
        onLostPointerCapture={(event) => hold(`pointer:${event.pointerId}`, false)}
        onClick={(event) => {
          if (event.detail === 0) hold('assistive', !sources.current.has('assistive'));
        }}
        onBlur={() => {
          for (const source of sources.current)
            if (source.startsWith('key:') || source === 'assistive') sources.current.delete(source);
          sync();
        }}
      >
        <span className={styles.arrow} aria-hidden="true">
          ↓
        </span>
        <b>{L('DUCK')}</b>
        <span>{duck ? L('Holding') : L('Hold')}</span>
      </button>
    </div>
  );
}
