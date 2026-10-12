import { useCallback, useEffect, useRef, useState } from 'react';
import type { HaxballControllerView } from '../server/index';
import type { Input } from '../server/types';
import { changeSource, controlPacket, heldVector, keyAction, sameVector } from './input-state';
import type { ControlAction, HeldSources } from './input-state';

export const CONTROL_HEARTBEAT_MS = 300;
const empty: HeldSources = {};

function canControl(view: HaxballControllerView): boolean {
  return (
    view.phaseId === 'play' &&
    !view.paused &&
    view.me.role === 'player' &&
    view.team !== null &&
    !view.departed
  );
}

export function useHeldControls(view: HaxballControllerView, send: (input: Input) => void) {
  const latest = useRef({ view, send });
  latest.current = { view, send };
  const held = useRef<HeldSources>(empty);
  const seat = useRef(view.me.id);
  const seq = useRef(-1);
  const previous = useRef(heldVector(empty));
  const key = `${view.me.id}:${view.phaseId}:${view.phaseAt}:${view.paused}:${view.departed}`;
  const [snapshot, setSnapshot] = useState({ key, held: empty });
  const enabled = canControl(view);

  const ensureSeat = useCallback((): void => {
    const current = latest.current.view;
    if (seat.current === current.me.id) return;
    seat.current = current.me.id;
    held.current = empty;
    seq.current = current.acceptedSeq;
    previous.current = heldVector(empty);
  }, []);

  const emit = useCallback(
    (sources: HeldSources, force = false): void => {
      ensureSeat();
      const vector = heldVector(sources);
      if (!force && sameVector(vector, previous.current)) return;
      const current = latest.current;
      const packet = controlPacket(
        seq.current,
        current.view.acceptedSeq,
        current.view.phaseAt,
        sources,
      );
      seq.current = packet.seq;
      previous.current = vector;
      current.send(packet);
    },
    [ensureSeat],
  );

  const update = useCallback(
    (source: string, action: ControlAction | null): void => {
      ensureSeat();
      if (action !== null && !canControl(latest.current.view)) return;
      const next = changeSource(held.current, source, action);
      if (next === held.current) return;
      held.current = next;
      const v = latest.current.view;
      setSnapshot({
        key: `${v.me.id}:${v.phaseId}:${v.phaseAt}:${v.paused}:${v.departed}`,
        held: next,
      });
      emit(next);
    },
    [emit, ensureSeat],
  );

  const release = useCallback(
    (publish = true): void => {
      held.current = empty;
      emit(empty);
      if (publish) {
        const v = latest.current.view;
        setSnapshot({
          key: `${v.me.id}:${v.phaseId}:${v.phaseAt}:${v.paused}:${v.departed}`,
          held: empty,
        });
      }
    },
    [emit],
  );

  useEffect(() => {
    release();
    if (!enabled) return undefined;
    const blur = (): void => release();
    const visibility = (): void => {
      if (document.hidden) release();
    };
    const keyboard =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const source = `key:${event.key.toLowerCase()}`;
        // Key-up still releases after focus moved into another control or a text field.
        if (!down) {
          if (held.current[source] !== undefined) {
            event.preventDefault();
            update(source, null);
          }
          return;
        }
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
        const focused = target?.closest('[data-hax-control]')?.getAttribute('data-hax-control');
        const action =
          event.key === 'Enter' && focused ? (focused as ControlAction) : keyAction(event.key);
        if (action === null) return;
        event.preventDefault();
        // A held key must not restart a source released by a phase change or blur.
        // The heartbeat sustains the original press without keyboard repeats.
        if (event.repeat) return;
        update(source, action);
      };
    const keydown = keyboard(true);
    const keyup = keyboard(false);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    const heartbeat = window.setInterval(() => {
      if (canControl(latest.current.view) && Object.keys(held.current).length > 0)
        emit(held.current, true);
    }, CONTROL_HEARTBEAT_MS);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      release(false);
    };
  }, [key, enabled, emit, update, release]);

  return {
    enabled,
    sources: enabled && snapshot.key === key ? snapshot.held : empty,
    update,
    release,
  };
}
