// A card table seen from straight above: a wooden rim and cloth, lit and shaded by the 3D scene.
// It is only the surface; seats, piles and cards are DOM drawn over it (so text stays sharp and
// flights are plain CSS). The CSS oval below is the same table while WebGL loads or if it is missing.
// The WebGL canvas is one shared one (felt-runtime.tsx), adopted by each phase's felt in turn: a TV
// remounts the game per phase and must not make a new WebGL context each time.
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

export interface TableFeltProps {
  /** The cloth, a concrete colour (it is also the colour of the 2D fallback). */
  cloth: string;
  /** The wooden rim. */
  rim?: string;
  /** Fraction of the stage width the oval fills, 0.5 to 1. */
  fill?: number;
}

export function TableFelt({ cloth, rim = '#3b2416', fill = 0.9 }: TableFeltProps): JSX.Element {
  // At scale 1 the rim spans 0.9027 of the stage width and 0.933 of its height.
  const s = fill / 0.9027;
  const inset = `${((1 - 0.933 * s) / 2) * 100}% ${((1 - fill) / 2) * 100}%`;
  const fallback = (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset,
        borderRadius: '50%',
        border: `23px solid ${rim}`,
        background: `radial-gradient(ellipse at 50% 45%, ${cloth} 0, color-mix(in srgb, ${cloth} 70%, #000) 100%)`,
        boxShadow: '0 0 80px rgb(0 0 0 / 60%) inset',
      }}
    />
  );
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let release = (): void => undefined;
    void import('./felt-runtime').then((runtime) => {
      if (!cancelled && holder.current)
        release = runtime.attachFelt(holder.current, { cloth, rim, s });
    });
    return () => {
      cancelled = true;
      release();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- later cloths go through setFelt, below
  useEffect(() => {
    void import('./felt-runtime').then((runtime) => runtime.setFelt({ cloth, rim, s }));
  }, [cloth, rim, s]);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {fallback}
      <div ref={holder} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
