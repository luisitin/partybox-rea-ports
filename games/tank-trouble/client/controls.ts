// Combine independent fingers and keys into one held command. The server repeats fire and expires a lost controller's lease.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buzz, useServerNow } from '@partybox/game-sdk/ui';
import type { Input } from '../server/world';
import { createControlsModel, EMPTY_CONTROLS, NEUTRAL_CONTROL } from './controls-model';
import type { ControlAction, ControlAxis, ControlUpdate, HeldControls } from './controls-model';
export type { ControlAction, ControlAxis, HeldControls } from './controls-model';
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
  steerStart: (source: string, drive: ControlAxis, turn: ControlAxis) => void;
  steerMove: (source: string, drive: ControlAxis, turn: ControlAxis) => void;
  steerEnd: (source: string) => void;
}

/** Every control source has its own key: lifting one finger never releases another finger or a held keyboard key. */
export function useControls(
  active: boolean,
  phaseKey: string,
  send: (input: Input) => void,
): Controls {
  const model = useRef(createControlsModel());
  const sent = useRef<Input>({ ...NEUTRAL_CONTROL });
  const latest = useRef({ active, send, phaseKey });
  latest.current = { active, send, phaseKey };
  const [lit, setLit] = useState({ key: phaseKey, held: { ...EMPTY_CONTROLS } });
  const now = useServerNow(300, !active);

  const clear = useCallback((force: boolean, paint = true): void => {
    const neutral = model.current.clear();
    if (paint) setLit({ key: latest.current.phaseKey, held: neutral.held });
    const wasHeld = sent.current.drive !== 0 || sent.current.turn !== 0 || sent.current.fire;
    sent.current = neutral.input;
    if (force || wasHeld) latest.current.send(neutral.input);
  }, []);

  const publish = useCallback((update: ControlUpdate | null): void => {
    if (!update) return;
    const next = update.input;
    setLit({ key: latest.current.phaseKey, held: update.held });
    if (
      next.drive === sent.current.drive &&
      next.turn === sent.current.turn &&
      next.fire === sent.current.fire
    )
      return;
    sent.current = next;
    latest.current.send(next);
  }, []);

  const press = useCallback(
    (action: ControlAction, source: string, down: boolean): void => {
      if (!latest.current.active) return;
      const update = model.current.press(action, source, down);
      if (update && down) buzz(8);
      publish(update);
    },
    [publish],
  );
  const steerStart = useCallback(
    (source: string, drive: ControlAxis, turn: ControlAxis): void => {
      if (!latest.current.active) return;
      const update = model.current.steerStart(source, drive, turn);
      if (update) buzz(8);
      publish(update);
    },
    [publish],
  );
  const steerMove = useCallback(
    (source: string, drive: ControlAxis, turn: ControlAxis): void => {
      if (latest.current.active) publish(model.current.steerMove(source, drive, turn));
    },
    [publish],
  );
  const steerEnd = useCallback(
    (source: string): void => {
      if (latest.current.active) publish(model.current.steerEnd(source));
    },
    [publish],
  );

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

  return {
    held: active && lit.key === phaseKey ? lit.held : EMPTY_CONTROLS,
    press,
    steerStart,
    steerMove,
    steerEnd,
  };
}
