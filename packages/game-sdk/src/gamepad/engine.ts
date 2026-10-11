// T-0602 / ADR-090: the pad engine behind `PadProvider`: polls `navigator.getGamepads()`, turns edges into
// presses, offers each to the game's handlers (newest first, `true` = consumed) and otherwise runs the default
// navigation (D-pad/stick moves a focus ring, A presses the ringed control, B presses `[data-pad-back]`).
// Loaded on demand (`import('./engine')`) the first time a pad shows up, so a phone without one never
// downloads it (the join page's budget, check-bundle). While a pad is connected `<html data-pad>` is set and
// the screen is kept awake (Wake Lock): a pad never touches it.
import { padKind } from './core';
import type { PadButton, PadKind } from './core';
import {
  activate,
  currentTarget,
  defaultTarget,
  focusables,
  goBack,
  isDirection,
  moveFocus,
  setTarget,
} from './nav';
import { PadTracker } from './tracker';
import type { PadSample } from './tracker';
import { holdAwake } from './wakeLock';

export interface EnginePadInfo {
  connected: boolean;
  kind: PadKind;
}

/** A game's press handler: return `true` when it used the press (the default navigation then skips it). */
export type EngineHandler = (button: PadButton, repeat: boolean) => boolean | void;

/** What the shell sees of `navigator.getGamepads()` (the DOM `Gamepad` reduced to what we read). */
export interface RawPad {
  id: string;
  connected: boolean;
  buttons: ArrayLike<{ pressed: boolean; value?: number }>;
  axes: ArrayLike<number>;
}

export function livePad(): RawPad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  try {
    const pads = navigator.getGamepads() as ArrayLike<RawPad | null>;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected !== false) return p;
    }
  } catch {
    // A blocked Gamepad API behaves like no pad.
  }
  return null;
}

function sampleOf(p: RawPad): PadSample {
  const buttons: boolean[] = [];
  for (let i = 0; i < p.buttons.length; i++) {
    const b = p.buttons[i];
    buttons.push(Boolean(b && (b.pressed || (b.value ?? 0) > 0.5)));
  }
  return {
    buttons,
    lx: p.axes[0] ?? 0,
    ly: p.axes[1] ?? 0,
    rx: p.axes[2] ?? 0,
    ry: p.axes[3] ?? 0,
  };
}

/** How often the ring is re-landed when its element left the screen (a new phase), and how often
 *  a pad that has not announced itself is looked for. */
const RELAND_MS = 250;
const SCAN_MS = 1000;

export interface EngineOptions {
  handlers: { current: EngineHandler[] };
  onInfo: (info: EnginePadInfo) => void;
}

/** Runs the pad loop until the returned stop function is called. */
export function startPadEngine({ handlers, onInfo }: EngineOptions): () => void {
  const tracker = new PadTracker();
  let raf = 0;
  let lastReland = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: EnginePadInfo = { connected: false, kind: 'generic' };
  let releaseAwake: (() => void) | null = null;
  const root = document.documentElement;

  const apply = (next: EnginePadInfo): void => {
    if (next.connected === current.connected && next.kind === current.kind) return;
    current = next;
    onInfo(next);
    if (next.connected) {
      root.dataset['pad'] = next.kind;
      releaseAwake ??= holdAwake();
      setTarget(defaultTarget());
    } else {
      delete root.dataset['pad'];
      currentTarget()?.removeAttribute('data-padfocus');
      releaseAwake?.();
      releaseAwake = null;
      tracker.reset();
    }
  };

  const dispatch = (button: PadButton, repeat: boolean): void => {
    for (let i = handlers.current.length - 1; i >= 0; i--) {
      if (handlers.current[i]?.(button, repeat) === true) return;
    }
    if (isDirection(button)) {
      moveFocus(button);
    } else if (button === 'a' && !repeat) {
      if (!activate()) {
        // A fresh screen the ring has not reached yet: the page's own primary acts at once (a
        // STOP the player hits the moment it shows); any other first press only lands the ring.
        const first = defaultTarget();
        setTarget(first);
        if (first?.hasAttribute('data-pad-primary')) first.click();
      }
    } else if (button === 'b' && !repeat) {
      goBack();
    }
  };

  const tick = (now: number): void => {
    const pad = livePad();
    if (pad) {
      apply({ connected: true, kind: padKind(pad.id) });
      for (const p of tracker.step(sampleOf(pad), now)) dispatch(p.button, p.repeat);
      const cur = currentTarget();
      if (!cur?.isConnected) {
        setTarget(defaultTarget()); // the screen changed under the ring
      } else if (now - lastReland >= RELAND_MS) {
        lastReland = now;
        if (!focusables().includes(cur)) setTarget(defaultTarget());
      }
      raf = requestAnimationFrame(tick);
      return;
    }
    apply({ connected: false, kind: 'generic' });
    // No pad: look again about once a second (Safari reports a pad only after its first press,
    // and a test double may not fire `gamepadconnected`), without waking every frame.
    timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, SCAN_MS);
  };

  const wake = (): void => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  window.addEventListener('gamepadconnected', wake);
  window.addEventListener('gamepaddisconnected', wake);
  raf = requestAnimationFrame(tick);
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener('gamepadconnected', wake);
    window.removeEventListener('gamepaddisconnected', wake);
    releaseAwake?.();
    delete root.dataset['pad'];
  };
}
