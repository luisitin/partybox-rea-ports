// A box's layout width, for the dial and the strip that place faces by it.
import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** The box's drawn width in CSS px (layout width, so a scaled stage does not skew it), measured
 *  before paint and again when it resizes; 0 until measured. */
export function useBoxPx(ref: RefObject<HTMLDivElement | null>): number {
  const [px, setPx] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = (): void => setPx(Math.round(el.offsetWidth / 8) * 8);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return px;
}
