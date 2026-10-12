// Combine independent fingers and keys into one held command. The server repeats fire and expires a lost controller's lease.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buzz, useServerNow } from '@partybox/game-sdk/ui';
import type { Input } from '../server/world';

export type ControlAction = 'forward' | 'reverse' | 'left' | 'right' | 'fire';
export type HeldControls = Record<ControlAction, boolean>;

const EMPTY: HeldControls = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  fire: false,
};
const NEUTRAL: Input = { type: 'control', drive: 0, turn: 0, fire: false };
const KEYS: Record<string, ControlAction> = {
  arrowup: 'forward',
  w: 'forward',
  arrowdown: 'reverse',
  s: 'reverse',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  ' ': 'fire',
  enter: 'fire',
};

interface Controls {
  held: HeldControls;
  press: (action: ControlAction, source: string, down: boolean) => void;
}

function readHeld(sources: Map<string, ControlAction>): HeldControls {
  const held = { ...EMPTY };
  for (const action of sources.values()) held[action] = true;
  return held;
}

function command(held: HeldControls): Input {
  return {
    type: 'control',
    drive: held.forward === held.reverse ? 0 : held.forward ? 1 : -1,
    turn: held.left === held.right ? 0 : held.right ? 1 : -1,
    fire: held.fire,
  };
}

/** Every control source has its own key: lifting one finger never releases another finger or a held keyboard key. */
export function useControls(
  active: boolean,
  phaseKey: string,
  send: (input: Input) => void,
): Controls {
  const sources = useRef(new Map<string, ControlAction>());
  const sent = useRef<Input>({ ...NEUTRAL });
  const latest = useRef({ active, send, phaseKey });
  latest.current = { active, send, phaseKey };
  const [lit, setLit] = useState({ key: phaseKey, held: { ...EMPTY } });
  const now = useServerNow(300, !active);

  const clear = useCallback((force: boolean, paint = true): void => {
    sources.current.clear();
    if (paint) setLit({ key: latest.current.phaseKey, held: { ...EMPTY } });
    const wasHeld = sent.current.drive !== 0 || sent.current.turn !== 0 || sent.current.fire;
    sent.current = { ...NEUTRAL };
    if (force || wasHeld) latest.current.send({ ...NEUTRAL });
  }, []);

  const press = useCallback((action: ControlAction, source: string, down: boolean): void => {
    if (!latest.current.active) return;
    if (down) {
      if (sources.current.get(source) === action) return;
      sources.current.set(source, action);
      buzz(8);
    } else if (!sources.current.delete(source)) return;
    const held = readHeld(sources.current);
    const next = command(held);
    setLit({ key: latest.current.phaseKey, held });
    if (
      next.drive === sent.current.drive &&
      next.turn === sent.current.turn &&
      next.fire === sent.current.fire
    )
      return;
    sent.current = next;
    latest.current.send(next);
  }, []);

  useEffect(() => {
    clear(active);
    if (!active) return;
    const key =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const target = event.target;
        if (
          down &&
          target instanceof HTMLElement &&
          target.closest('input, textarea, select, [contenteditable="true"]')
        )
          return;
        const name = event.key.toLowerCase();
        if (name === 'escape') {
          if (down) clear(false);
          return;
        }
        const action = KEYS[name];
        if (!action) return;
        event.preventDefault();
        press(action, `key:${name}`, down);
      };
    const down = key(true);
    const up = key(false);
    const blur = (): void => clear(false);
    const visibility = (): void => {
      if (document.visibilityState !== 'visible') clear(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pagehide', blur);
      document.removeEventListener('visibilitychange', visibility);
      clear(false, false);
    };
  }, [active, phaseKey, clear, press]);

  // No client fire loop: this heartbeat only keeps a held command's 1200 ms server lease fresh.
  useEffect(() => {
    if (active && (sent.current.drive !== 0 || sent.current.turn !== 0 || sent.current.fire)) {
      latest.current.send({ ...sent.current });
    }
  }, [active, now]);

  return { held: active && lit.key === phaseKey ? lit.held : EMPTY, press };
}
