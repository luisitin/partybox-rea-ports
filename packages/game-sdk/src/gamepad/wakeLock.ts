// T-0602: a pad never touches the screen, so the phone would dim and lock mid-turn. While a pad is
// connected we hold a screen Wake Lock, taking it again when the page returns to the foreground
// (the browser drops it on hide). Unsupported or refused (low battery): silently nothing.
interface Sentinel {
  release: () => Promise<void>;
}
interface WakeLockApi {
  request: (type: 'screen') => Promise<Sentinel>;
}

/** Hold the screen awake; returns the function that lets go. Safe to call anywhere. */
export function holdAwake(): () => void {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  if (!api) return () => undefined;
  let sentinel: Sentinel | null = null;
  let stopped = false;
  const take = (): void => {
    if (stopped || sentinel || document.visibilityState !== 'visible') return;
    api
      .request('screen')
      .then((s) => {
        if (stopped) void s.release().catch(() => undefined);
        else sentinel = s;
      })
      .catch(() => undefined);
  };
  const onVisible = (): void => {
    sentinel = null; // the browser released it when the page hid
    take();
  };
  document.addEventListener('visibilitychange', onVisible);
  take();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}
