// T-0602 / ADR-090: gamepad play on the phone. A pad paired to the phone (a DualSense over
// Bluetooth shows up in `navigator.getGamepads()` once a button is pressed) drives the game:
// `PadProvider` watches for one, and the first time one shows up loads the engine (engine.ts: polling,
// presses offered to the game's handlers via `usePadPress`, newest first, `true` = consumed, else the
// default navigation: D-pad/stick moves a focus ring, A presses the ringed control, B presses
// `[data-pad-back]`). While a pad is connected `<html data-pad>` is set: the stylesheet hides
// `[data-touch-only]` hints, draws the ring and `PadGlyph` prompts appear; the screen is kept awake
// (Wake Lock) because a pad never touches it. A phone without a pad never downloads the engine.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { PadButton, PadKind } from './core';

export interface PadInfo {
  connected: boolean;
  kind: PadKind;
}

/** A game's press handler: return  when it used the press (the default navigation then skips it). */
export type PadHandler = (button: PadButton, repeat: boolean) => boolean | void;

interface PadApi extends PadInfo {
  register: (h: PadHandler) => () => void;
}

const NONE: PadApi = { connected: false, kind: 'generic', register: () => () => undefined };
const PadContext = createContext<PadApi>(NONE);

/** Is a pad plugged in right now? (A blocked Gamepad API behaves like no pad.) */
function hasPad(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  try {
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i]?.connected !== false && pads[i]) return true;
  } catch {
    // Treated as no pad.
  }
  return false;
}

/** How often a pad that has not announced itself is looked for (Safari reports one only after its first press). */
const SCAN_MS = 1000;

export function PadProvider({ children }: { children: ReactNode }): JSX.Element {
  const [info, setInfo] = useState<PadInfo>({ connected: false, kind: 'generic' });
  const handlers = useRef<PadHandler[]>([]);
  const register = useMemo(
    () =>
      (h: PadHandler): (() => void) => {
        handlers.current.push(h);
        return () => {
          handlers.current = handlers.current.filter((x) => x !== h);
        };
      },
    [],
  );

  useEffect(() => {
    let alive = true;
    let stop: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    const load = (): void => {
      if (loading) return;
      loading = true;
      clearTimeout(timer);
      window.removeEventListener('gamepadconnected', load);
      void import('./engine').then((m) => {
        if (alive) stop = m.startPadEngine({ handlers, onInfo: setInfo });
      });
    };
    function check(): void {
      if (hasPad()) load();
      else timer = setTimeout(check, SCAN_MS);
    }
    window.addEventListener('gamepadconnected', load);
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('gamepadconnected', load);
      stop?.();
    };
  }, []);

  const api = useMemo<PadApi>(
    () => ({ connected: info.connected, kind: info.kind, register }),
    [info.connected, info.kind, register],
  );
  return <PadContext.Provider value={api}>{children}</PadContext.Provider>;
}

/** Is a pad connected, and which kind (for glyphs). `connected: false` outside any shell. */
export function usePad(): PadInfo {
  const { connected, kind } = useContext(PadContext);
  return { connected, kind };
}

/**
 * Handle pad buttons while this component is mounted (and `enabled`). Return `true` for a press
 * you used; anything else falls through to the default focus navigation. Newest handler first.
 */
export function usePadPress(handler: PadHandler, enabled = true): void {
  const { register } = useContext(PadContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    return register((b, r) => latest.current(b, r));
  }, [register, enabled]);
}
