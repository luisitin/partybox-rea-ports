// A game's results-stage Finale as its own download (ADR-050) that the TV can fetch ahead: the
// shell calls `preload()` while the game plays, so the results screen never waits for it (T-0226).
import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { GameFinaleProps } from '../client-module';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each game narrows its own view
type FinaleComponent = ComponentType<GameFinaleProps<any>>;

export type LazyFinale = LazyExoticComponent<FinaleComponent> & {
  /** Starts the download (once); rendering it later then does not suspend. */
  preload: () => Promise<FinaleComponent>;
  /** The component once downloaded, else null: render it directly, never through Suspense
   *  (React.lazy suspends once even when the chunk is in, and Suspense holds its fallback 300 ms). */
  loaded: () => FinaleComponent | null;
};

/** `Finale: lazyFinale(() => import('./Finale').then((m) => m.Finale))` in a game's tv-entry. */
export function lazyFinale(load: () => Promise<FinaleComponent>): LazyFinale {
  let pending: Promise<FinaleComponent> | null = null;
  let done: FinaleComponent | null = null;
  const preload = (): Promise<FinaleComponent> => {
    // A failed download is asked again next time (the loader's retries live in the shell).
    pending ??= load()
      .then((c) => (done = c))
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
    return pending;
  };
  return Object.assign(
    lazy(() => preload().then((c) => ({ default: c }))),
    { preload, loaded: () => done },
  );
}
