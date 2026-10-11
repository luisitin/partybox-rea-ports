// Adopted API patterns from R3F Canvas and react-three-rapier's Physics/RigidBody examples.
// Browser/physics code lives only in this dynamic import; see docs/sdk/table3d.md.
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Color, MeshStandardMaterial, Texture } from 'three';
import type { Group, Material, Mesh, Object3D, Scene, WebGLRenderer } from 'three';
import { usePrefersReducedMotion } from '../ui/motion';
import { Cinema } from './cinema';
import { solidGeometry } from './geometry';
import { Exposure, Key, NeutralTone, SlowFrames, StudioEnvironment } from './layers';
import { pulseWave } from './pulse';
import { Snapshot } from './snapshot';
import { TableReducedMotion, useTableReducedMotion } from './reduced';
import type { Pulse3dProps, Solid3dProps, Spin3dProps, Table3dProps, Track3dProps } from './types';
import { newWarm, warmFrame } from './warm';

class WebglBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; onError?: (error: Error) => void },
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
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Calls `onReady` on the first frame, or (`warm`, the Cinematic tier) once the scene has drawn smoothly for a few
 *  seconds, so the browser's first-draw shader compiles hit while the game still shows its stand-in (warm.ts). */
function Ready({ onReady, warm }: { onReady?: () => void; warm: boolean }): null {
  const ready = useRef(false);
  const watch = useRef(newWarm());
  useFrame(({ clock }, delta) => {
    if (ready.current) return;
    if (warm && !warmFrame(watch.current, clock.elapsedTime, delta)) return;
    ready.current = true;
    onReady?.();
  });
  return null;
}

/**
 * T-0332: three (r186) keeps one DFG lookup texture for the whole page (`getDFGLUT`, not exported),
 * and every renderer that draws a standard material hangs a `dispose` listener on it that
 * `WebGLRenderer.dispose()` never takes off: the page's one texture kept every renderer it ever made
 * alive, each with its WebGL context, its scene and the screen around its canvas. Found once from a
 * drawn material's uniforms; disposed once a torn-down renderer has lost its context, which takes
 * every listener off (a renderer still drawing uploads the 16×16 texture again on its next frame).
 */
let dfgLut: Texture | null = null;

function findDfgLut(gl: WebGLRenderer, scene: Scene): void {
  scene.traverse((object: Object3D) => {
    const material = (object as Object3D & { material?: Material | Material[] }).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      const props = gl.properties.get(m) as { uniforms?: { dfgLUT?: { value?: unknown } } };
      const value = props.uniforms?.dfgLUT?.value;
      if (value instanceof Texture) dfgLut = value;
    }
  });
}

/** Looks for the shared lookup texture over the first frames (a scene with no standard material has none). */
function FindDfgLut(): null {
  const tries = useRef(0);
  useFrame(({ gl, scene }) => {
    if (dfgLut || tries.current >= 30) return;
    tries.current += 1;
    findDfgLut(gl, scene);
  });
  return null;
}

export function Table3dRuntime({
  children,
  camera = {},
  style,
  reducedMotion,
  maxDpr = 1.5,
  paused = false,
  shadows = false,
  defaultLights = true,
  keyLight,
  environment,
  environmentIntensity = 0.55,
  exposure,
  toneMapping,
  rig,
  spot,
  post,
  onTier,
  fallback = null,
  onReady,
  onError,
}: Table3dProps): JSX.Element {
  const prefersReduced = usePrefersReducedMotion();
  const reduced = prefersReduced || reducedMotion === true;
  const [lost, setLost] = useState(false);
  const [tier, setTier] = useState<'cinematic' | 'sharp'>('cinematic');
  const postOn = post !== undefined && tier === 'cinematic';
  // Stable however the parent passes `onTier`: Cinema and SlowFrames hold `demote`, and a new function per render
  // would look like a change to everything that depends on it (T-0333 F1).
  const tierCallback = useRef(onTier);
  useEffect(() => {
    tierCallback.current = onTier;
  });
  const demote = useCallback(() => {
    setTier('sharp');
    tierCallback.current?.('sharp');
  }, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { orthographic = false, target = [0, 0, 0], ...cameraProps } = camera;
  // The display's own ratio is the ceiling: more than one sample per device pixel only costs frames. The ratio
  // is fixed for the canvas's life (T-0329): resizing a WebGL drawing buffer while it runs leaves the canvas
  // presenting blank in WebKit (the D-036 review browser), so there is no adaptive resolution.
  const ceiling = Math.max(
    1,
    Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
  );
  const manual = ['left', 'right', 'top', 'bottom'].every((key) => key in camera);
  if (lost) return <>{fallback}</>;
  return (
    <WebglBoundary fallback={fallback} onError={onError}>
      <TableReducedMotion.Provider value={reduced}>
        {/* One canvas for the table's life (T-0403): giving up the Cinematic tier used to swap the canvas (a new
            key and an `antialias` flip: now MSAA is on from the start, so a demoted table keeps it), and the TV showed an empty stage for ~0.7 s while the new renderer
            drew its first frame, then a camera that started over. Cinema switches the chain off on this canvas. */}
        <Canvas
          style={style}
          orthographic={orthographic}
          camera={{
            near: 0.1,
            far: 4000,
            ...cameraProps,
            manual,
            position: cameraProps.position ? [...cameraProps.position] : [5, 7, 8],
            up: cameraProps.up ? [...cameraProps.up] : [0, 1, 0],
          }}
          // Layout px, not screen px: the TV's html zoom scales client rects, and a canvas sized from one is too small
          // by the zoom (T-0471). offsetWidth/Height are not zoomed.
          resize={{ offsetSize: true, scroll: true, debounce: { scroll: 50, resize: 0 } }}
          dpr={[1, ceiling]}
          frameloop={paused ? 'never' : 'always'}
          shadows={shadows ? 'soft' : false}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          fallback={fallback}
          onCreated={({ camera: instance, gl }) => {
            instance.lookAt(...target);
            instance.updateProjectionMatrix();
            gl.domElement.addEventListener(
              'webglcontextlost',
              () => {
                // Unmounted, or swapped out for the other tier's canvas (a new `key`): R3F tears the old renderer
                // down half a second after it left the page and forces its context lost on purpose (T-0332).
                // Only a canvas still on the page can have lost its context for real.
                if (!mounted.current || !gl.domElement.isConnected) return dfgLut?.dispose();
                setLost(true);
                onError?.(new Error('The table WebGL context was lost.'));
              },
              { once: true },
            );
          }}
        >
          <FindDfgLut />
          <Snapshot />
          {defaultLights && (
            <>
              <ambientLight intensity={1.1} />
              <directionalLight position={[-4, 8, 6]} intensity={2.2} />
            </>
          )}
          {keyLight && <Key light={keyLight} shadows={shadows} />}
          {postOn && !post.keep && <SlowFrames onSlow={demote} />}
          {toneMapping === 'neutral' && <NeutralTone />}
          {exposure !== undefined && <Exposure value={exposure} />}
          {(rig || postOn) && (
            <Cinema
              rig={rig}
              spot={spot}
              post={postOn ? post : undefined}
              reduced={reduced}
              onFail={demote}
            />
          )}
          {environment === 'studio' && <StudioEnvironment intensity={environmentIntensity} />}
          <Suspense fallback={null}>
            <Physics paused={reduced} timeStep={1 / 60}>
              {children}
              <Ready onReady={onReady} warm={postOn} />
            </Physics>
          </Suspense>
        </Canvas>
      </TableReducedMotion.Provider>
    </WebglBoundary>
  );
}

export function Solid3dRuntime({
  mesh,
  color = '#bdc6cc',
  position,
  rotation,
  scale,
  metalness = 0.68,
  roughness = 0.3,
  crease,
}: Solid3dProps): JSX.Element {
  const geometry = useMemo(() => solidGeometry(mesh, crease), [mesh, crease]);
  const materials = useMemo(
    () => [
      new MeshStandardMaterial({ color, metalness, roughness }),
      new MeshStandardMaterial({
        color: new Color(color).multiplyScalar(0.28),
        metalness: 0.4,
        roughness: 0.4,
      }),
      new MeshStandardMaterial({ color: '#eef3f5', metalness: 0.7, roughness: 0.24 }),
    ],
    [color, metalness, roughness],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  return (
    <RigidBody
      type="fixed"
      colliders="hull"
      position={position ? [...position] : undefined}
      rotation={rotation ? [...rotation] : undefined}
    >
      <mesh
        castShadow
        receiveShadow
        geometry={geometry}
        material={materials}
        scale={typeof scale === 'number' ? scale : scale ? [...scale] : undefined}
      />
    </RigidBody>
  );
}

export function Pulse3dRuntime({
  children,
  position,
  rotation,
  period = 1.6,
  amount = 0.12,
}: Pulse3dProps): JSX.Element {
  const ref = useRef<Group>(null);
  const reduced = useTableReducedMotion();
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const wave = pulseWave(clock.elapsedTime, period, reduced);
    group.scale.setScalar(1 + amount * wave);
    group.traverse((node) => {
      const material = (node as Mesh).material as Material | Material[] | undefined;
      if (!material || Array.isArray(material) || !material.transparent) return;
      const base = (material.userData.pulseBase ??= material.opacity) as number;
      material.opacity = base * (0.55 + 0.45 * (1 - wave));
    });
  });
  return (
    <group
      ref={ref}
      position={position ? [...position] : undefined}
      rotation={rotation ? [...rotation] : undefined}
    >
      {children}
    </group>
  );
}

export function Track3dRuntime({ children, track }: Track3dProps): JSX.Element {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const pose = track();
    group.visible = pose !== null;
    if (!pose) return;
    group.position.set(...pose.position);
    group.rotation.set(pose.rotationX ?? 0, pose.rotationY ?? 0, pose.rotationZ ?? 0);
    if (typeof pose.scale === 'number') group.scale.setScalar(pose.scale);
    else if (pose.scale) group.scale.set(...pose.scale);
    else group.scale.setScalar(1);
    const opacity = pose.opacity ?? 1;
    group.traverse((node) => {
      const material = (node as Mesh).material as Material | Material[] | undefined;
      if (!material || Array.isArray(material) || !material.transparent) return;
      const base = (material.userData.trackBase ??= material.opacity) as number;
      material.opacity = base * opacity;
    });
  });
  return <group ref={ref}>{children}</group>;
}

export function Spin3dRuntime({
  children,
  position,
  scale = 1,
  period = 14,
  phase = 0,
}: Spin3dProps): JSX.Element {
  const ref = useRef<Group>(null);
  const reduced = useTableReducedMotion();
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.rotation.y = reduced
        ? phase * Math.PI * 2
        : (clock.elapsedTime / period + phase) * Math.PI * 2;
  });
  return (
    <group ref={ref} position={position ? [...position] : undefined} scale={scale}>
      {children}
    </group>
  );
}
