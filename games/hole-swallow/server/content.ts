// Original object tuning: progressively larger silhouettes, no external assets or content.
import type { PropKind } from './types';

export const PROP_RULES: Readonly<Record<PropKind, { radius: number; points: number }>> = {
  bin: { radius: 1, points: 2 },
  tree: { radius: 1.7, points: 3 },
  bench: { radius: 2.6, points: 5 },
  car: { radius: 4.2, points: 12 },
  house: { radius: 7, points: 28 },
  tower: { radius: 10, points: 60 },
};
export const DISTRICT_PROPS: readonly PropKind[] = [
  'bin',
  'bin',
  'bin',
  'bin',
  'tree',
  'tree',
  'tree',
  'tree',
  'bench',
  'bench',
  'bench',
  'bench',
  'car',
  'car',
  'car',
  'car',
  'house',
  'house',
  'tower',
];
