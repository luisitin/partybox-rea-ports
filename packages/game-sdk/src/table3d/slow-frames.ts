// Has the scene been running slow for a while? Apart from the render loop so it can be tested without WebGL.
// It only watches: the canvas's resolution never changes at runtime (T-0329: resizing a WebGL drawing buffer
// leaves the canvas presenting blank in WebKit), so a slow scene gives up effects, not pixels.
export type SlowWatch = { sum: number; frames: number; slow: number };

/** Frames per decision (about three quarters of a second at 60 fps). */
export const SLOW_WINDOW = 45;
/** A window whose frames averaged longer than this (under 40 fps) is slow. */
const SLOW = 1 / 40;
/** Slow windows in a row before the scene is asked to give up its costly effects. */
const SLOW_WINDOWS = 3;

export const newSlowWatch = (): SlowWatch => ({ sum: 0, frames: 0, slow: 0 });

/** Feed one frame's `delta` (seconds). True once enough slow windows ran in a row; the count then starts over.
 *  A long pause (a hidden tab) counts as 100 ms, not as slowness. */
export function watchFrame(w: SlowWatch, delta: number): boolean {
  w.sum += Math.min(delta, 0.1);
  if (++w.frames < SLOW_WINDOW) return false;
  const avg = w.sum / w.frames;
  w.sum = w.frames = 0;
  w.slow = avg > SLOW ? w.slow + 1 : 0;
  if (w.slow < SLOW_WINDOWS) return false;
  w.slow = 0;
  return true;
}
