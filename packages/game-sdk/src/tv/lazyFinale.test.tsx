// T-0226: a game's Finale fetched ahead while the game plays, so the results stage never waits.
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { lazyFinale } from './lazyFinale';

const Final = (): JSX.Element => <p>the end</p>;

describe('lazyFinale (T-0226)', () => {
  it('downloads once, however often it is preloaded', async () => {
    const load = vi.fn(async () => Final);
    const Finale = lazyFinale(load);
    await Promise.all([Finale.preload(), Finale.preload()]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed download', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(Final);
    const Finale = lazyFinale(load);
    await expect(Finale.preload()).rejects.toThrow('offline');
    await expect(Finale.preload()).resolves.toBe(Final);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('hands over the downloaded component, so the shell renders it without Suspense', async () => {
    const Finale = lazyFinale(async () => Final);
    expect(Finale.loaded()).toBeNull();
    await Finale.preload();
    expect(Finale.loaded()).toBe(Final);
  });
});
