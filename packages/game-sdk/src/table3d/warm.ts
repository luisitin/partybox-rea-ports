// When has the table's GPU settled? Apart from the render loop so it can be tested without WebGL (T-0329 F13).
// A fresh browser compiles each shader again when it is first drawn (ANGLE on Windows hands the HLSL to worker threads
// and the frame that needs one waits): the Cinematic tier's first seconds hold one to three frames of 0.6 to 1.5 s.
// They cannot be moved off the GPU, but they can happen while the game still shows its own stand-in, so `onReady`
// waits for the scene to have run smoothly for a while.
export type Warm = { start: number; bad: number; frames: number; sum: number };

/** The least time the scene is drawn before it is called ready (seconds). */
export const WARM = 3;
/** ... and the quiet it needs since its last long frame. */
export const CALM = 1.2;
/** The most it waits, whatever happens (a machine that never settles). */
export const WARM_CAP = 7;
/** A frame this long is a hitch. */
const HITCH = 0.05;
/** After this many frames a machine averaging worse than this has nothing to settle (software GL): ready at once. */
const SAMPLE = 20;
const SLOW = 1 / 25;

export const newWarm = (): Warm => ({ start: -1, bad: 0, frames: 0, sum: 0 });

/** Feed each frame with the clock `now` and `delta` (both seconds). True when the table may be shown. */
export function warmFrame(w: Warm, now: number, delta: number): boolean {
  if (w.start < 0) w.start = w.bad = now;
  if (delta > HITCH) w.bad = now;
  if (w.frames < SAMPLE) {
    w.sum += Math.min(delta, 0.1);
    if (++w.frames === SAMPLE && w.sum / SAMPLE > SLOW) return true;
  }
  const age = now - w.start;
  return age >= WARM_CAP || (age >= WARM && now - w.bad >= CALM);
}
