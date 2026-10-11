// Isolated entry: ordinary UI and pure game code never import the WebGL/physics runtime.
import { lazy, Suspense, useEffect, useState } from 'react';
import { createElement } from 'react';
import type { ComponentType, JSX, ReactNode } from 'react';
import { Component } from 'react';
import type {
  Dice3dProps,
  Drop3dProps,
  Model3dProps,
  Pulse3dProps,
  Solid3dProps,
  Spin3dProps,
  Table3dProps,
  Track3dProps,
} from './table3d/types';
import { isChunkLoadError, recovery } from './table3d/chunk-recovery';
export { projectSolid } from './table3d/project';
export type {
  CameraRig,
  Dice3dProps,
  Drop3dProps,
  DiceTray,
  FollowSpot,
  GroupPose,
  KeyLight,
  MeshData,
  Model3dProps,
  ModelPose,
  Point3,
  PostSettings,
  ProjectedSolidFace,
  Pulse3dProps,
  Skin3d,
  Solid3dProps,
  Spin3dProps,
  Table3dProps,
  TableCamera,
  Track3dProps,
} from './table3d/types';

const Table = lazy(() =>
  recovery
    .chunk(() => import('./table3d/runtime'))
    .then((module) => ({ default: module.Table3dRuntime })),
);
const Spin = lazy(() =>
  recovery
    .chunk(() => import('./table3d/runtime'))
    .then((module) => ({ default: module.Spin3dRuntime })),
);
const Pulse = lazy(() =>
  recovery
    .chunk(() => import('./table3d/runtime'))
    .then((module) => ({ default: module.Pulse3dRuntime })),
);
/** A component that loads its chunk without suspending: inside the canvas a lazy component that suspends hides the
 *  whole scene until it arrives (a blank flash at the first roll or the first house), so this one draws nothing
 *  until its code is there and then appears. */
function deferred<P extends object>(
  load: () => Promise<ComponentType<P>>,
): {
  Deferred: (props: P) => JSX.Element | null;
  start: () => Promise<void>;
} {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const start = (): Promise<void> =>
    (pending ??= load().then((component) => {
      loaded = component;
    }));
  function Deferred(props: P): JSX.Element | null {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => loaded);
    useEffect(() => {
      if (Component) return;
      let live = true;
      start().then(
        () => live && setComponent(() => loaded),
        () => undefined,
      );
      return () => {
        live = false;
      };
    }, [Component]);
    return Component ? createElement(Component, props) : null;
  }
  return { Deferred, start };
}
const dice = deferred<Dice3dProps>(() =>
  recovery.chunk(() => import('./table3d/dice')).then((module) => module.Dice3dRuntime),
);
const drop = deferred<Drop3dProps>(() =>
  recovery.chunk(() => import('./table3d/drop')).then((module) => module.Drop3dRuntime),
);
const Solid = lazy(() =>
  recovery
    .chunk(() => import('./table3d/runtime'))
    .then((module) => ({ default: module.Solid3dRuntime })),
);

const Track = lazy(() =>
  recovery
    .chunk(() => import('./table3d/runtime'))
    .then((module) => ({ default: module.Track3dRuntime })),
);

const Model = lazy(() =>
  recovery
    .chunk(() => import('./table3d/model'))
    .then((module) => ({ default: module.Model3dRuntime })),
);

export function Table3d(props: Table3dProps): JSX.Element {
  const stand = props.fallback ?? null;
  return createElement(
    RuntimeBoundary,
    { fallback: stand },
    createElement(Suspense, { fallback: stand }, createElement(Table, props)),
  );
}

/** Render only inside Table3d: its Suspense boundary owns the lazy solid's loading state. */
export function Solid3d(props: Solid3dProps): JSX.Element {
  return createElement(Solid, props);
}

/** Render only inside Table3d. A ring or halo that breathes; static under reduced motion. */
export function Pulse3d(props: Pulse3dProps): JSX.Element {
  return createElement(Pulse, props);
}

/** Render only inside Table3d. A group that follows `track` each frame: position, turn, scale and fade, no React renders. */
export function Track3d(props: Track3dProps): JSX.Element {
  return createElement(Track, props);
}

/** Render only inside Table3d. A group on a slow turntable (a piece shown off); still under reduced motion. */
export function Spin3d(props: Spin3dProps): JSX.Element {
  return createElement(Spin, props);
}

/** Render only inside Table3d. Dice thrown by the physics engine that land on the numbers the game chose. */
export function Dice3d(props: Dice3dProps): JSX.Element {
  return createElement(dice.Deferred, props);
}

/** Render only inside Table3d. A group that falls into place on the physics engine (a house dropped on its square). */
export function Drop3d(props: Drop3dProps): JSX.Element {
  return createElement(drop.Deferred, props);
}

/** Starts downloading the code for `Dice3d` and `Drop3d` now (a table that will throw dice or drop pieces calls this when it
 *  mounts), so the first roll or build does not wait for it. Safe to call again; a failed download just leaves them undrawn. */
export function preloadTable3dExtras(): void {
  for (const part of [dice, drop]) part.start().catch(() => undefined);
}

/** A 3D runtime that fails to download (a dropped Wi-Fi) must not take the game down: the stand-in stays up, and the
 *  page comes back for the board once the server answers (table3d/chunk-recovery.ts, T-0950). */
class RuntimeBoundary extends Component<
  { fallback: ReactNode; children?: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    if (isChunkLoadError(error)) recovery.recover();
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A model that fails to load (a missing file, bad GLB) must not take the table down: it just stays out. */
class ModelBoundary extends Component<
  { onError?: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Render only inside Table3d. A GLB in metal that follows `track` each frame (docs/sdk/table3d.md). */
export function Model3d(props: Model3dProps): JSX.Element {
  return createElement(ModelBoundary, {
    onError: props.onError,
    children: createElement(Model, props),
  });
}
export { TableFelt } from './table3d/TableFelt';
export type { TableFeltProps } from './table3d/TableFelt';
export { useFlights } from './table3d/flights';
export type { Flight, FlightPoint } from './table3d/flights';
