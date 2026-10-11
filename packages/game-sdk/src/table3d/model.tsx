// A GLB inside Table3d (T-0352). Browser code: loaded only through the dynamic import in ../ui-table3d.ts,
// like runtime.tsx. The GLTF loader and its parsing ship in that same lazy chunk.
// A model with painted textures keeps its own PBR materials; a bare mesh is drawn in tinted metal.
// A skinned GLB with clips (T-0579) plays the clip the pose names, cross-fading when the name changes.
import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import {
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  Vector3,
} from 'three';
import type { AnimationAction, Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinKey } from './skin';
import { skinMaterial, useSkinMap } from './skin-three';
import type { Model3dProps } from './types';

const hasPaint = (m: Material | Material[]): boolean =>
  (Array.isArray(m) ? m : [m]).some((x) => x instanceof MeshStandardMaterial && x.map !== null);

/** Seconds one clip takes to fade into the next. */
const FADE_S = 0.16;

interface Playing {
  name: string;
  key: number;
  action: AnimationAction;
}

export function Model3dRuntime({
  url,
  color = '#c3cad0',
  position = [0, 0, 0],
  size = 1,
  castShadow = false,
  skin,
  track,
}: Model3dProps): JSX.Element {
  const gltf = useLoader(GLTFLoader, url);
  const map = useSkinMap(skin?.map);
  const group = useRef<Group>(null);
  const playing = useRef<Playing | null>(null);
  const metal = useMemo(
    () => new MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.3 }),
    [color],
  );
  // The loader caches the parsed scene per url: a clone shares geometry and painted materials, so only our
  // metal is ours to free. The clone is wrapped so its longest side is 1, centred on x/z, standing on y = 0.
  // A skinned model needs its own skeleton, so it is cloned with SkeletonUtils (the plain clone shares bones).
  const built = useMemo(() => {
    const skinned = gltf.animations.length > 0;
    const made: Material[] = [];
    const copy = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
    copy.traverse((node) => {
      // Limbs swing out of the rest pose's bounds: never cull a skinned mesh by them.
      if (node instanceof SkinnedMesh) node.frustumCulled = false;
      if (!(node instanceof Mesh)) return;
      node.castShadow = castShadow;
      // A model with clips is a painted character even when its colours are flat materials (the mascot).
      if (skinned || hasPaint(node.material)) {
        if (skin) node.material = skinMaterial(node.material, skin, map, made);
        return;
      }
      // Bare meshes (the glb-lod output) have positions and indices only; smooth normals are cheap.
      if (!node.geometry.getAttribute('normal')) node.geometry.computeVertexNormals();
      node.material = metal;
    });
    copy.updateMatrixWorld(true);
    const box = new Box3().setFromObject(copy);
    const dims = box.getSize(new Vector3());
    const mid = box.getCenter(new Vector3());
    const k = 1 / (Math.max(dims.x, dims.y, dims.z) || 1);
    const wrap = new Group();
    copy.position.set(-mid.x, -box.min.y, -mid.z);
    wrap.add(copy);
    wrap.scale.setScalar(k);
    const outer = new Group();
    outer.add(wrap);
    return { scene: outer, mixer: skinned ? new AnimationMixer(copy) : null, made };
    // skinKey: a skin with the same paint is the same model, whichever object names it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, metal, castShadow, map, skin && skinKey(skin)]);
  const { scene, mixer, made } = built;
  useEffect(() => () => metal.dispose(), [metal]);
  // The copies made for the skin are ours; the textures they wear are shared and freed by useSkinMap.
  useEffect(() => () => made.forEach((m) => m.dispose()), [made]);
  useEffect(
    () => () => {
      mixer?.stopAllAction();
      playing.current = null;
    },
    [mixer],
  );
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const pose = track?.() ?? (track ? null : { position, size });
    g.visible = pose !== null;
    if (!pose) return;
    g.position.set(...pose.position);
    g.scale.set(pose.size, pose.size * (pose.squash ?? 1), pose.size);
    // The tip is about the table's axes, not the model's own: Euler order XZY turns y first, then tips.
    g.rotation.order = 'XZY';
    g.rotation.set(pose.rotationX ?? 0, pose.rotationY ?? 0, pose.rotationZ ?? 0);
    if (!mixer) return;
    const name = pose.clip ?? '';
    const key = pose.clipKey ?? 0;
    const now = playing.current;
    if (name && (!now || now.name !== name || now.key !== key)) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(pose.clipOnce ? LoopOnce : LoopRepeat, Infinity);
        action.clampWhenFinished = true;
        if (now) action.crossFadeFrom(now.action, FADE_S, false);
        action.play();
        playing.current = { name, key, action };
      }
    }
    if (playing.current) playing.current.action.timeScale = pose.clipSpeed ?? 1;
    mixer.update(delta);
  });
  return (
    <group ref={group} visible={false}>
      <primitive object={scene} />
    </group>
  );
}
