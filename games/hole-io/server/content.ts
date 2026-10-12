// Original port rewards and silhouettes. Historical growth gates are in world.ts;
// these rewards/supplies are tuning, not an assertion of current native constants.
import type { PropKind } from './types';

export const PROP_RULES: Readonly<Record<PropKind, { radius: number; points: number }>> = {
  bin: { radius: 1, points: 1 },
  tree: { radius: 1.7, points: 2 },
  bench: { radius: 2.6, points: 3 },
  car: { radius: 4.2, points: 3 },
  house: { radius: 7, points: 4 },
  tower: { radius: 10, points: 30 },
};
export const DISTRICT_PROPS: readonly PropKind[] = [
  ...Array<PropKind>(16).fill('bin'),
  ...Array<PropKind>(14).fill('tree'),
  ...Array<PropKind>(13).fill('bench'),
  ...Array<PropKind>(18).fill('car'),
  ...Array<PropKind>(10).fill('house'),
  ...Array<PropKind>(3).fill('tower'),
];
