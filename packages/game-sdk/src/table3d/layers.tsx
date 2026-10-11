// The scene layers Table3dRuntime mounts inside the Canvas: slow-frame watch, key light, studio reflections, exposure.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { NeutralToneMapping, PMREMGenerator } from 'three';
import type { DirectionalLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { newSlowWatch, watchFrame } from './slow-frames';
import type { KeyLight } from './types';

/** Calls `onSlow` once frames have run slow for a while (slow-frames.ts): the caller gives up an effect. */
export function SlowFrames({ onSlow }: { onSlow: () => void }): null {
  const watch = useRef(newSlowWatch());
  useFrame((_, delta) => {
    if (watchFrame(watch.current, delta)) onSlow();
  });
  return null;
}

/** A directional light and its target: the target has to live in the scene for the aim (and the shadow) to follow. */
export function Key({ light, shadows }: { light: KeyLight; shadows: boolean }): JSX.Element {
  const scene = useThree((state) => state.scene);
  const ref = useRef<DirectionalLight>(null);
  const [tx, ty, tz] = light.target ?? [0, 0, 0];
  useEffect(() => {
    const instance = ref.current;
    if (!instance) return;
    instance.target.position.set(tx, ty, tz);
    scene.add(instance.target);
    return () => {
      scene.remove(instance.target);
    };
  }, [scene, tx, ty, tz]);
  const shadow = shadows ? light.shadow : undefined;
  const e = shadow?.extent ?? 1;
  useEffect(() => {
    // Bounds set through props do not rebuild the shadow camera's projection.
    ref.current?.shadow.camera.updateProjectionMatrix();
  }, [e]);
  return (
    <directionalLight
      ref={ref}
      position={[...light.position]}
      intensity={light.intensity ?? 2}
      color={light.color ?? '#ffffff'}
      castShadow={shadow !== undefined}
      shadow-mapSize={[shadow?.mapSize ?? 2048, shadow?.mapSize ?? 2048]}
      shadow-camera-left={-e}
      shadow-camera-right={e}
      shadow-camera-top={e}
      shadow-camera-bottom={-e}
      shadow-camera-near={10}
      shadow-camera-far={5000}
      shadow-bias={shadow?.bias ?? -0.0004}
      shadow-normalBias={1.5}
    />
  );
}

export function StudioEnvironment({ intensity }: { intensity: number }): null {
  const gl = useThree((state) => state.gl);
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, get]);
  useEffect(() => {
    get().scene.environmentIntensity = intensity;
  }, [get, intensity]);
  return null;
}

export function Exposure({ value }: { value: number }): null {
  const get = useThree((state) => state.get);
  useEffect(() => {
    get().gl.toneMappingExposure = value;
  }, [get, value]);
  return null;
}

/** Neutral tone mapping (the renderer's ACES default would wash the colours); put back when the table goes. */
export function NeutralTone(): null {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl } = get();
    const before = gl.toneMapping;
    gl.toneMapping = NeutralToneMapping;
    return () => {
      gl.toneMapping = before;
    };
  }, [get]);
  return null;
}
