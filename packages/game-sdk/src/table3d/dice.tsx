// The dice of a roll: the baked throw (dice-bake.ts) replayed against the game's clock, drawn as rounded ivory cubes
// with pips. Mutates the groups in the frame loop, so a roll costs no React renders.
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import {
  CircleGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry, Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { usePrefersReducedMotion } from '../ui/motion';
import { DIE_FACES, bakeDiceRoll, sampleDie } from './dice-bake';
import type { DiceBake } from './dice-bake';
import { restingGlide, stepGlide } from './dice-glide';
import type { Glide } from './dice-glide';
import type { Dice3dProps } from './types';

/** Pip grid cells (-1, 0, 1 across and up) for each number. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
};

/** All of a die's pips as one geometry: flat discs a hair off each face, turned to face outward. */
function pipGeometry(size: number): BufferGeometry {
  const discs: BufferGeometry[] = [];
  const z = new Vector3(0, 0, 1);
  for (const face of DIE_FACES) {
    const normal = new Vector3(...face.normal),
      u = new Vector3(...face.u),
      v = new Vector3(...face.v);
    const turn = new Quaternion().setFromUnitVectors(z, normal);
    for (const [a, b] of PIPS[face.value]!) {
      const disc = new CircleGeometry(size * 0.075, 24);
      disc.applyQuaternion(turn);
      const at = normal
        .clone()
        .multiplyScalar(size / 2 + 0.12)
        .addScaledVector(u, a * size * 0.26)
        .addScaledVector(v, b * size * 0.26);
      disc.translate(at.x, at.y, at.z);
      discs.push(disc);
    }
  }
  const merged = mergeGeometries(discs)!;
  discs.forEach((disc) => disc.dispose());
  return merged;
}

/** The throwaway bake has run in this page. */
let warmed = false;

export function Dice3dRuntime({
  values,
  seed,
  startedAt,
  clock,
  tray,
  size = 30,
  durationMs = 1000,
  color = '#f4f0e6',
  pipColor = '#17181a',
  reducedMotion = false,
  hold,
}: Dice3dProps): JSX.Element | null {
  const { rapier } = useRapier();
  const reduced = usePrefersReducedMotion() || reducedMotion;
  const groups = useRef<(Group | null)[]>([]);
  const wanted = values.join(',');
  const bake = useMemo((): DiceBake | null => {
    const faces = wanted ? wanted.split(',').map(Number) : [];
    return faces.length
      ? bakeDiceRoll(rapier, {
          values: faces,
          seed,
          size,
          tray: { x: tray.x, z: tray.z, width: tray.width, depth: tray.depth, floor: tray.floor },
        })
      : null;
  }, [rapier, wanted, seed, size, tray.x, tray.z, tray.width, tray.depth, tray.floor]);
  const body = useMemo(() => new RoundedBoxGeometry(size, size, size, 4, size * 0.12), [size]);
  const pips = useMemo(() => pipGeometry(size), [size]);
  const bodyMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
      }),
    [color],
  );
  const pipMaterial = useMemo(
    () => new MeshStandardMaterial({ color: pipColor, roughness: 0.45 }),
    [pipColor],
  );
  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => () => pips.dispose(), [pips]);
  useEffect(() => () => bodyMaterial.dispose(), [bodyMaterial]);
  useEffect(() => () => pipMaterial.dispose(), [pipMaterial]);
  // T-0403: the first roll used to cost ~1 s in one frame (the physics bake, the two shaders). Pay it when the
  // table mounts instead: bake a throwaway roll once, and keep the dice drawn (far below the floor, tiny) so
  // the scene's compile builds their programs.
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (warmed) return;
    warmed = true;
    bakeDiceRoll(rapier, {
      values: [1, 1],
      seed: 1,
      size,
      tray: { x: tray.x, z: tray.z, width: tray.width, depth: tray.depth, floor: tray.floor },
    });
  }, [rapier, size, tray.x, tray.z, tray.width, tray.depth, tray.floor]);
  const warm = !bake;
  const compiled = useRef(false);
  useEffect(() => {
    if (!warm || compiled.current) return;
    compiled.current = true;
    gl.compile(scene, camera);
  }, [warm, gl, scene, camera]);
  // How far each die has glided to its hold slot (0 thrown, 1 held); a new throw starts every die at its own answer.
  const glide = useRef<{ seed: number; at: Glide[] }>({ seed: -1, at: [] });
  useFrame((_, delta) => {
    if (!bake) return;
    const elapsed = reduced ? Infinity : clock() - startedAt;
    const seconds = (Math.max(0, elapsed) / Math.max(1, durationMs)) * bake.seconds;
    const g = glide.current;
    const fresh = g.seed !== seed || reduced;
    g.seed = seed;
    groups.current.forEach((group, i) => {
      if (!group || i >= bake.dice) return;
      const slot = hold?.[i] ?? null;
      const goal = slot ? 1 : 0;
      const previous = g.at[i];
      const [k, next]: [number, Glide] =
        fresh || previous === undefined
          ? [goal, restingGlide(goal)]
          : stepGlide(previous, goal, delta);
      g.at[i] = next;
      // A held die keeps the pose the throw ended in; only its place changes.
      const { position, rotation } = sampleDie(bake, i, k > 0 ? bake.seconds : seconds);
      const rest = sampleDie(bake, i, bake.seconds).position;
      const from = slot ? rest : position;
      const x = slot ? from[0] + (slot.x - from[0]) * k : position[0];
      const z = slot ? from[2] + (slot.z - from[2]) * k : position[2];
      group.position.set(x, position[1], z);
      group.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
      group.visible = true;
    });
  });
  if (!bake)
    return (
      <group position={[0, -5000, 0]} scale={0.001}>
        <mesh geometry={body} material={bodyMaterial} />
        <mesh geometry={pips} material={pipMaterial} />
      </group>
    );
  return (
    <group>
      {Array.from({ length: bake.dice }, (_, i) => (
        <group
          key={i}
          ref={(group) => {
            groups.current[i] = group;
          }}
          visible={false}
        >
          <mesh geometry={body} material={bodyMaterial} castShadow receiveShadow />
          <mesh geometry={pips} material={pipMaterial} />
        </group>
      ))}
    </group>
  );
}
