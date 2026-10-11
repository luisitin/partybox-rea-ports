// The cinematic layer: a gliding camera rig, a follow spot, and the lazy post chain.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { SpotLight } from 'three';
import { PostLife } from './post-life';
import { readSpring3, spring3, stepSpring3 } from './smooth';
import type { Spring3 } from './smooth';
import type { CameraRig, FollowSpot, PostSettings } from './types';

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** The cinematic layer: a camera that glides to `rig`, a spot that follows its focus, and the post chain.
 *  One component so one frame callback moves the camera, the light and the focus plane, then draws. */
export function Cinema({
  rig,
  spot,
  post,
  reduced,
  onFail,
}: {
  rig?: CameraRig;
  spot?: FollowSpot;
  post?: PostSettings;
  reduced: boolean;
  onFail: () => void;
}): JSX.Element | null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const goal = useRef(rig);
  const springs = useRef<{ position: Spring3; target: Spring3; focus: Spring3 } | null>(null);
  const light = useRef<SpotLight>(null);
  // One controller owns the chain (post-life.ts): a new `onFail` from the parent is only stored, so a parent that
  // re-renders every frame never rebuilds the chain (T-0333 F1).
  const [life] = useState(
    () =>
      new PostLife(() => import('./post'), { width: size.width, height: size.height, dpr }, onFail),
  );
  const postKey = post ? JSON.stringify(post) : '';
  const lit = spot !== undefined && rig !== undefined;
  useEffect(() => {
    life.listen(onFail);
  });
  useEffect(() => {
    goal.current = rig;
  }, [rig]);
  useEffect(() => {
    life.resize({ width: size.width, height: size.height, dpr });
  }, [life, size.width, size.height, dpr]);
  useEffect(() => {
    const instance = light.current;
    if (!instance) return;
    scene.add(instance.target);
    return () => {
      scene.remove(instance.target);
    };
  }, [scene, lit]);
  useEffect(() => {
    life.sync({ gl, scene, camera }, postKey ? (JSON.parse(postKey) as PostSettings) : null);
  }, [life, gl, scene, camera, postKey]);
  useEffect(() => () => life.down(), [life]);
  // The camera and light move first; with `post` a priority-1 callback owns the drawing (R3F then stops
  // drawing by itself), and until the chain has loaded it draws the plain scene.
  useFrame(
    (_, delta) => {
      const g = goal.current;
      let focus: readonly number[] | undefined;
      if (g) {
        const s = (springs.current ??= {
          position: spring3(g.position),
          target: spring3(g.target),
          focus: spring3(g.focus ?? g.target),
        });
        const settle = reduced ? 0 : (g.settle ?? 0.7);
        stepSpring3(s.position, g.position, settle, delta);
        stepSpring3(s.target, g.target, settle, delta);
        stepSpring3(s.focus, g.focus ?? g.target, settle, delta);
        const p = readSpring3(s.position),
          t = readSpring3(s.target);
        camera.position.set(p[0], p[1], p[2]);
        camera.lookAt(t[0], t[1], t[2]);
        focus = readSpring3(s.focus);
        const lamp = light.current;
        if (lamp) {
          lamp.position.set(focus[0]!, focus[1]! + (spot?.height ?? 1200), focus[2]!);
          lamp.target.position.set(focus[0]!, focus[1]!, focus[2]!);
          lamp.target.updateMatrixWorld();
        }
      }
      if (!post) return;
      if (life.chain) {
        const at = focus ?? [0, 0, 0];
        life.chain.render(delta, distance(camera.position.toArray(), at));
      } else gl.render(scene, camera);
    },
    post ? 1 : 0,
  );
  if (!lit) return null;
  return (
    <spotLight
      ref={light}
      color={spot.color ?? '#ffe6bf'}
      intensity={spot.intensity ?? 1}
      angle={spot.angle ?? 0.32}
      penumbra={spot.penumbra ?? 0.85}
      decay={0}
      distance={0}
    />
  );
}
