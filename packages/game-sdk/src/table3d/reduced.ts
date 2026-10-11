// Table3d's reduced-motion setting for the parts drawn inside its canvas (a React context reaches them:
// R3F bridges the contexts above its Canvas).
import { createContext, useContext } from 'react';
import { usePrefersReducedMotion } from '../ui/motion';

/** What a `Table3d` was told through its `reducedMotion` prop; the viewer's own preference still counts too. */
export const TableReducedMotion = createContext(false);

/** True when the viewer prefers less motion, or the Table3d this sits in was told `reducedMotion`. */
export function useTableReducedMotion(): boolean {
  const told = useContext(TableReducedMotion);
  const prefers = usePrefersReducedMotion();
  return told || prefers;
}
