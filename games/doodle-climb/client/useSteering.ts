// Held pointer and keyboard sources combine; every exit releases the server direction.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Input } from '../server/types';

type Side = 'left' | 'right';

export interface SteeringControls {
  left: boolean;
  right: boolean;
  hold: (side: Side, down: boolean, source: string) => void;
  release: () => void;
}

export function useSteering(
  enabled: boolean,
  roundKey: string,
  send: (input: Input) => void,
): SteeringControls {
  const sources = useRef(new Map<string, Side>());
  const sent = useRef<-1 | 0 | 1>(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  const [lit, setLit] = useState({ key: '', left: false, right: false });
  const sync = useCallback((): void => {
    const sides = [...sources.current.values()];
    const left = sides.includes('left');
    const right = sides.includes('right');
    const dir = left === right ? 0 : right ? 1 : -1;
    setLit({ key: roundKey, left, right });
    if (dir === sent.current) return;
    sent.current = dir;
    sendRef.current({ type: 'steer', dir });
  }, [roundKey]);
  const release = useCallback((): void => {
    sources.current.clear();
    sync();
  }, [sync]);
  const hold = useCallback(
    (side: Side, down: boolean, source: string): void => {
      if (!enabled) return;
      if (down) sources.current.set(source, side);
      else sources.current.delete(source);
      sync();
    },
    [enabled, sync],
  );
  useEffect(() => {
    sources.current.clear();
    sent.current = 0;
    if (!enabled) return;
    const key =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const k = event.key.toLowerCase();
        const side =
          k === 'arrowleft' || k === 'a'
            ? 'left'
            : k === 'arrowright' || k === 'd'
              ? 'right'
              : null;
        if (!side) return;
        event.preventDefault();
        hold(side, down, `key:${k}`);
      };
    const down = key(true);
    const up = key(false);
    const hidden = (): void => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hidden);
      sources.current.clear();
      // Cleanup cannot depend on another render: the last direction must leave with the controls.
      if (sent.current !== 0) sendRef.current({ type: 'steer', dir: 0 });
      sent.current = 0;
    };
  }, [enabled, roundKey, hold, release]);
  return {
    left: enabled && lit.key === roundKey && lit.left,
    right: enabled && lit.key === roundKey && lit.right,
    hold,
    release,
  };
}
