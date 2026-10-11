// A group that falls into place: the baked drop (drop-bake.ts) replayed against the game's clock. Before `startedAt` the
// children are not drawn; after the fall they sit exactly where the game put them.
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import type { JSX } from 'react';
import type { Group } from 'three';
import { usePrefersReducedMotion } from '../ui/motion';
import { bakeDrop, sampleDrop } from './drop-bake';
import type { DropBake } from './drop-bake';
import type { Drop3dProps } from './types';

export function Drop3dRuntime({
  children,
  seed,
  size,
  height = 80,
  startedAt,
  clock,
  durationMs,
  reducedMotion = false,
}: Drop3dProps): JSX.Element {
  const { rapier } = useRapier();
  const reduced = usePrefersReducedMotion() || reducedMotion;
  const group = useRef<Group>(null);
  const [w, h, d] = size;
  const bake = useMemo(
    (): DropBake => bakeDrop(rapier, { seed, size: [w, h, d], height }),
    [rapier, seed, w, h, d, height],
  );
  const scale = durationMs ? bake.seconds / (durationMs / 1000) : 1;
  const settled = useRef(false);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const elapsed = clock() - startedAt;
    if (reduced || elapsed >= (bake.seconds / scale) * 1000) {
      if (!settled.current || !g.visible) {
        g.position.set(0, 0, 0);
        g.quaternion.set(0, 0, 0, 1);
        g.visible = true;
        settled.current = true;
      }
      return;
    }
    settled.current = false;
    g.visible = elapsed >= 0;
    if (!g.visible) return;
    const { position, rotation } = sampleDrop(bake, (elapsed / 1000) * scale);
    g.position.set(position[0], position[1], position[2]);
    g.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
  });
  // Hidden until the first frame has placed it, so a house never shows at rest for a frame before it falls.
  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  );
}
