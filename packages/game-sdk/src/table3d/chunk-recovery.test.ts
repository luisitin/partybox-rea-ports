// T-0950: a failed 3D chunk brings the page back once the server answers, and only a few times in a short window.
import { describe, expect, it, vi } from 'vitest';
import type { RecoveryDeps } from './chunk-recovery';
import {
  RELOAD_LIMIT,
  RELOAD_WINDOW_MS,
  RETRY_MS,
  createRecovery,
  isChunkLoadError,
} from './chunk-recovery';

const NOW = 1_000_000;
const chunkError = new TypeError(
  'Failed to fetch dynamically imported module: https://host/assets/runtime.js',
);

/** Deps that answer at once, with no reloads on record unless the test says so. */
function fakeDeps(over: Partial<RecoveryDeps> = {}) {
  let stored: number[] = [];
  return {
    probe: vi.fn(async () => undefined),
    wait: vi.fn(async () => undefined),
    reload: vi.fn(),
    reloads: vi.fn(() => stored),
    remember: vi.fn((times: number[]) => {
      stored = times;
    }),
    now: () => NOW,
    ...over,
  };
}

describe('isChunkLoadError (T-0950)', () => {
  it('knows the wording of Chromium, Firefox and Safari, and nothing else', () => {
    expect(isChunkLoadError(chunkError)).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: x'))).toBe(
      true,
    );
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('bug in the scene'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('createRecovery (T-0950)', () => {
  it('reloads once the server answers, probing again after each failed try', async () => {
    const deps = fakeDeps({
      probe: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockResolvedValue(undefined),
    });
    const { chunk } = createRecovery(deps);
    await expect(chunk(() => Promise.reject(chunkError))).rejects.toBe(chunkError);
    await vi.waitFor(() => expect(deps.reload).toHaveBeenCalledTimes(1));
    expect(deps.probe).toHaveBeenCalledTimes(3);
    expect(deps.wait).toHaveBeenCalledWith(RETRY_MS);
    expect(deps.remember).toHaveBeenCalledWith([NOW]);
  });

  it('runs one wait loop however many chunks fail at once', async () => {
    const deps = fakeDeps({
      probe: vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(undefined),
    });
    const { chunk } = createRecovery(deps);
    await Promise.allSettled([
      chunk(() => Promise.reject(chunkError)),
      chunk(() => Promise.reject(chunkError)),
    ]);
    await vi.waitFor(() => expect(deps.reload).toHaveBeenCalledTimes(1));
    expect(deps.wait).toHaveBeenCalledTimes(2);
  });

  it('leaves any other error to the boundary, with no wait and no reload', async () => {
    const deps = fakeDeps();
    const { chunk } = createRecovery(deps);
    await expect(chunk(() => Promise.reject(new Error('bug in the scene')))).rejects.toThrow(
      'bug in the scene',
    );
    expect(deps.wait).not.toHaveBeenCalled();
  });

  it('stops reloading once the limit is reached within the window', async () => {
    const recent = Array.from({ length: RELOAD_LIMIT }, (_, i) => NOW - 1000 * (i + 1));
    const deps = fakeDeps({ reloads: () => recent });
    const { chunk } = createRecovery(deps);
    await expect(chunk(() => Promise.reject(chunkError))).rejects.toBe(chunkError);
    await vi.waitFor(() => expect(deps.probe).toHaveBeenCalledTimes(1));
    await new Promise((done) => setTimeout(done, 0));
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('reloads again once the old reloads have left the window', async () => {
    const old = Array.from(
      { length: RELOAD_LIMIT },
      (_, i) => NOW - RELOAD_WINDOW_MS - 1000 * (i + 1),
    );
    const deps = fakeDeps({ reloads: () => old });
    const { chunk } = createRecovery(deps);
    await expect(chunk(() => Promise.reject(chunkError))).rejects.toBe(chunkError);
    await vi.waitFor(() => expect(deps.reload).toHaveBeenCalledTimes(1));
    expect(deps.remember).toHaveBeenCalledWith([NOW]);
  });
});
