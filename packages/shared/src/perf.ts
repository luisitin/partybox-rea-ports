// The smoothness meter's wire shape (T-0544, ADR-083): what a TV or a phone says about its own frames,
// batched once per PERF_WINDOW_MS over the socket. Numbers only plus a few short names: no PII beyond the
// player name the server already holds (the server adds it; the client never sends one).
import { z } from 'zod';

/** How long a client collects before it reports. */
export const PERF_WINDOW_MS = 20_000;

const ms = z.number().finite().min(0).max(600_000);
const count = z.number().int().min(0).max(1_000_000);

export const perfReportSchema = z.object({
  role: z.enum(['tv', 'phone']),
  /** Coarse class from the user agent (never the agent string itself). */
  device: z.enum(['ios', 'android', 'desktop', 'other']),
  /** The game on screen when the window ended; null in the lobby or the picker. */
  game: z.string().max(32).nullable(),
  windowMs: z.number().int().min(1).max(120_000),
  frames: count,
  /** requestAnimationFrame deltas in milliseconds. */
  dt: z.object({ p50: ms, p95: ms, max: ms }),
  /** Frames missed against the device's own cadence (a 30 fps phone drops nothing by being 30 fps). */
  dropped: count,
  /** Long animation frames (Chromium only): how many, the worst, and the scripts behind the worst. */
  loaf: z.object({ count, maxMs: ms, scripts: z.array(z.string().max(60)).max(5) }),
  /** Last socket round trip (emit to ack), null before the first one. */
  rttMs: ms.nullable(),
  video: z.object({ waiting: count, stalled: count }),
  /** WebGL context losses in the window. */
  glLost: count,
  /** Frame rate capped near 30 fps (a phone in low-power mode, or one that cannot keep up). */
  lowPower: z.boolean(),
});
export type PerfReport = z.infer<typeof perfReportSchema>;
