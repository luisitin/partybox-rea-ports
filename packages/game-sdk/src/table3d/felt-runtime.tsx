// The felt's WebGL, kept alive across the TV's phase swaps. The TV remounts a game's whole Tv per phase,
// and a <Canvas> per mount made a WebGL context (and left a WebGLRenderer on the heap) for every one:
// 43 contexts and 42 renderers in a 10-round Uno match (T-0344-gl). Here ONE canvas and ONE renderer
// serve the whole match: a mounting felt adopts it, an unmounting one parks it, and it is disposed
// only when no felt has taken it back for PARK_MS (the game is over).
import { createRoot, extend } from '@react-three/fiber';
import type { JSX } from 'react';
import * as THREE from 'three';
import type { TableCamera } from './types';

export interface FeltSpec {
  cloth: string;
  rim: string;
  /** Scale of the oval, from the fraction of the stage it fills. */
  s: number;
}

// Straight down, 16:9: 2134 x 1200 world units cover the stage.
const CAMERA: TableCamera = {
  orthographic: true,
  position: [0, 1500, 0],
  target: [0, 0, 0],
  up: [0, 0, -1],
  left: -1067,
  right: 1067,
  top: 600,
  bottom: -600,
  near: 1,
  far: 3000,
};
const PARK_MS = 2000;
// A root made by hand (the <Canvas> does this itself) knows no three.js element until told.
extend(THREE as unknown as Parameters<typeof extend>[0]);

type FeltRoot = ReturnType<typeof createRoot>;
let shared: { host: HTMLDivElement; root: FeltRoot; resize: ResizeObserver } | null = null;
let parkTimer = 0;

function scene({ cloth, rim, s }: FeltSpec): JSX.Element {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-4, 8, 6]} intensity={2.2} />
      <mesh position={[0, 20, 0]} scale={[1.72 * s, 1, s]}>
        <cylinderGeometry args={[560, 548, 40, 96]} />
        <meshStandardMaterial color={rim} roughness={0.55} />
      </mesh>
      <mesh position={[0, 26, 0]} scale={[1.72 * s, 1, s]}>
        <cylinderGeometry args={[520, 520, 40, 96]} />
        <meshStandardMaterial color={cloth} roughness={0.95} />
      </mesh>
    </>
  );
}

function create(spec: FeltSpec): NonNullable<typeof shared> {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(canvas);
  const root = createRoot(canvas);
  const { orthographic, target = [0, 0, 0], position, up, ...camera } = CAMERA;
  root.configure({
    orthographic,
    camera: {
      ...camera,
      manual: true,
      position: position ? [...position] : [0, 0, 0],
      up: up ? [...up] : [0, 1, 0],
    },
    dpr: [1, 1.5],
    gl: { alpha: true, antialias: true },
    size: { width: 1, height: 1, top: 0, left: 0 },
    onCreated: ({ camera: instance }) => {
      instance.lookAt(...target);
      instance.updateProjectionMatrix();
    },
  });
  // A parked host is hidden and has no size: keep the last real one.
  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry?.contentRect ?? { width: 0, height: 0 };
    if (width > 0 && height > 0) {
      root.configure({ size: { width, height, top: 0, left: 0 } });
    }
  });
  resize.observe(host);
  root.render(scene(spec));
  return { host, root, resize };
}

/** Puts the shared felt into `container` (creating it the first time). Returns the release. */
export function attachFelt(container: HTMLElement, spec: FeltSpec): () => void {
  window.clearTimeout(parkTimer);
  try {
    shared ??= create(spec);
  } catch {
    return () => undefined; // no WebGL: the CSS oval under it stays
  }
  shared.host.style.display = '';
  container.appendChild(shared.host);
  return () => {
    const held = shared;
    if (!held) return;
    // Parked in the page, not dropped: the canvas keeps its context while the next phase mounts.
    if (held.host.parentElement === container) {
      container.ownerDocument.body.appendChild(held.host);
      held.host.style.display = 'none';
    }
    window.clearTimeout(parkTimer);
    parkTimer = window.setTimeout(() => {
      if (shared !== held || held.host.parentElement !== held.host.ownerDocument.body) return;
      held.resize.disconnect();
      held.root.unmount();
      held.host.remove();
      shared = null;
    }, PARK_MS);
  };
}

/** A new cloth or rim for the felt in play. */
export function setFelt(spec: FeltSpec): void {
  shared?.root.render(scene(spec));
}
