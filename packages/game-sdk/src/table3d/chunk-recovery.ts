// A 3D runtime chunk that fails to download (a Wi-Fi drop, a sleeping phone) stays failed for the life of the page: the
// browser caches the failed module, so a retry of the same URL fails at once with no request (T-0950). The only way back
// to the board is a fresh page. So after a chunk fails we wait until the server answers and reload, a few times in a
// short window at most, so a broken build cannot loop.

export const RETRY_MS = 2000;
export const RELOAD_LIMIT = 3;
export const RELOAD_WINDOW_MS = 10 * 60 * 1000;

/** The browsers' wording for a dynamic import that did not download: Chromium, Firefox and Safari. */
const CHUNK_ERRORS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
];

export function isChunkLoadError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && CHUNK_ERRORS.some((text) => message.includes(text));
}

export interface RecoveryDeps {
  /** Resolves once the server answers any request; rejects while the network is down. */
  probe: () => Promise<unknown>;
  wait: (ms: number) => Promise<void>;
  reload: () => void;
  /** Epoch times of the reloads this tab already made for a chunk. */
  reloads: () => number[];
  remember: (times: number[]) => void;
  now: () => number;
}

/** One recovery per page: the first failed chunk starts the wait, later failures join it. */
export function createRecovery(deps: RecoveryDeps): {
  recover: () => void;
  chunk: <M>(load: () => Promise<M>) => Promise<M>;
} {
  let armed = false;
  const recover = (): void => {
    if (armed) return;
    armed = true;
    void (async () => {
      let answered = false;
      while (!answered) {
        await deps.wait(RETRY_MS);
        answered = await deps.probe().then(
          () => true,
          () => false,
        );
      }
      const now = deps.now();
      const recent = deps.reloads().filter((at) => now - at < RELOAD_WINDOW_MS);
      if (recent.length >= RELOAD_LIMIT) return;
      deps.remember([...recent, now]);
      deps.reload();
    })();
  };
  /** Downloads a runtime chunk; a failure asks for the page to come back, then rethrows for the boundary. */
  const chunk = <M>(load: () => Promise<M>): Promise<M> =>
    load().catch((error: unknown) => {
      if (isChunkLoadError(error)) recover();
      throw error;
    });
  return { recover, chunk };
}

function browserDeps(): RecoveryDeps {
  const key = 'partybox.chunk-reloads';
  return {
    probe: () => fetch('/', { cache: 'no-store' }),
    wait: (ms) => new Promise((done) => setTimeout(done, ms)),
    reload: () => window.location.reload(),
    reloads: () => {
      try {
        const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? (parsed as number[]) : [];
      } catch {
        return [];
      }
    },
    remember: (times) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(times));
      } catch {
        // No storage (a private window): the limit is then not kept, which is the lesser harm.
      }
    },
    now: () => Date.now(),
  };
}

/** The app's recovery, wired to the browser. */
export const recovery = createRecovery(browserDeps());
