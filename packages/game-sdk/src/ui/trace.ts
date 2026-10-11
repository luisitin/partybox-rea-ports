// A trace sink for the audio harness (packages/e2e/src/design/audio-trace.ts): the shell's synth,
// the music engine, a game's caller and the haptics all report here. Off unless a test page sets
// `window.__pbTrace = []` before the app loads — production never pays for it.
export interface TraceEvent {
  t: number;
  kind: string;
  [key: string]: unknown;
}

export function trace(kind: string, data: Record<string, unknown> = {}): void {
  const sink = (globalThis as { __pbTrace?: TraceEvent[] }).__pbTrace;
  if (!sink) return;
  sink.push({ t: Math.round(performance.now()), kind, ...data });
}
