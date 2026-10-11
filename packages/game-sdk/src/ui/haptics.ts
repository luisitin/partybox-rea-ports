// Haptics for the phone: a short buzz is the most accessible non-visual confirmation in a loud
// room. Android Chrome only (iOS Safari has no navigator.vibrate; calls before the page's first
// user activation are dropped) — so the visual press state stays the load-bearing feedback and
// every call here is fire-and-forget. Not gated on prefers-reduced-motion (a 20 ms buzz is not
// animation); the player can switch it off (`partybox:haptics`, default on).
import { trace } from './trace';

const KEY = 'partybox:haptics';

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode */
  }
}

/**
 * Before the page's first tap the browser drops a vibrate and logs a console error every time
 * ("Blocked call to navigator.vibrate…") — a phone that reloads mid-game buzzed on every push until
 * touched, 180 errors in one resume sweep (2026-09-22). Where the browser can say, ask it first.
 */
function activated(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return ua === undefined || ua.hasBeenActive;
}

/** When the pattern now running ends (`navigator.vibrate` replaces, it never queues). */
let busyUntil = 0;
/** The last pattern and when: the same one twice inside 30 ms is one buzz (loop 344 — a Ready
 * tap's own 20 ms and the shell's "locked in" 20 ms, 22 ms apart). */
let last: { key: string; at: number } | null = null;

/**
 * Vibrate for `pattern` ms (or an on/off pattern); silently a no-op where unsupported. A shorter
 * buzz never cuts a longer one still running: the shell's 20 ms "locked in" tick used to land on
 * the same tick as a winner's 320 ms celebration and replace it (loop 334). A pattern at least as
 * long as what is left takes over (an error over a tap).
 */
export function buzz(pattern: number | number[]): void {
  const total = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
  const now = performance.now();
  const key = JSON.stringify(pattern);
  if ((now < busyUntil && total < busyUntil - now) || (last?.key === key && now - last.at < 30)) {
    trace('buzz:dropped', { pattern });
    return;
  }
  last = { key, at: now };
  busyUntil = now + total;
  trace('buzz', { pattern });
  if (!hapticsEnabled() || !activated()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
