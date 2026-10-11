// The shared juice layer (T-0341): one call for a burst of particles + a sting cue, and a number that counts up and
// pops. Off under reduced motion (particles and the pop never render; the cue and the final number still happen).
// Pure React + CSS: transform and opacity only, so a phone holds 60 fps. Deterministic from the seed (juice-math.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { burstMs, particlesOf, seedOf, SHAPES } from './juice-math';
import type { JuiceKind } from './juice-math';
import { useCountUp, usePrefersReducedMotion } from './motion';
import { useSound } from './sound';
import type { SoundCue } from './sound';
import styles from './Juice.module.css';

export interface BurstProps {
  kind: JuiceKind;
  /** Seed of the particle look; give a moment's key so it is the same everywhere. */
  seed?: string | number;
  /** The origin inside the nearest positioned ancestor: any CSS length, default the centre. */
  x?: string;
  y?: string;
  count?: number;
}

/** One burst, mounted where it happens. Renders nothing under reduced motion. */
export function Burst({
  kind,
  seed = 1,
  x = '50%',
  y = '50%',
  count,
}: BurstProps): JSX.Element | null {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <span
      className={styles.burst}
      aria-hidden="true"
      data-juice={kind}
      style={{ '--j-x': x, '--j-y': y, '--j-ms': `${SHAPES[kind].ms}ms` } as CSSProperties}
    >
      {particlesOf(kind, seedOf(seed), count).map((p, i) => (
        <i
          key={i}
          className={`${styles.p} ${styles[kind]} ${styles['t' + p.tone]}`}
          style={
            {
              '--j-dx': `${p.dx}px`,
              '--j-dy': `${p.dy}px`,
              '--j-fall': `${p.fall}px`,
              '--j-rot': `${p.rot}deg`,
              '--j-scale': p.scale,
              '--j-delay': `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

export interface JuiceOptions extends Omit<BurstProps, 'kind'> {
  /** The sting that goes with it (the shell's synth); none by default. */
  cue?: SoundCue;
}

interface Live extends BurstProps {
  id: number;
}

/**
 * `const [juice, layer] = useJuice();` — render `{layer}` inside a positioned box, then
 * `juice('coins', { x: '30%', y: '60%', cue: 'claim', seed: key })` is the whole call: it plays the sting and
 * throws the burst, which removes itself when it lands. Reduced motion keeps the sting, drops the particles.
 */
export function useJuice(): [(kind: JuiceKind, opts?: JuiceOptions) => void, JSX.Element | null] {
  const play = useSound();
  const [live, setLive] = useState<Live[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const t of all) clearTimeout(t);
      all.clear();
    };
  }, []);
  const juice = useCallback(
    (kind: JuiceKind, opts: JuiceOptions = {}) => {
      const { cue, ...rest } = opts;
      if (cue) play(cue);
      const id = nextId.current++;
      setLive((l) => [...l.slice(-7), { kind, ...rest, id }]);
      const t = setTimeout(() => {
        timers.current.delete(t);
        setLive((l) => l.filter((b) => b.id !== id));
      }, burstMs(kind));
      timers.current.add(t);
    },
    [play],
  );
  const layer = live.length ? (
    <>
      {live.map(({ id, ...b }) => (
        <Burst key={id} {...b} />
      ))}
    </>
  ) : null;
  return [juice, layer];
}

export interface NumberPopProps {
  value: number;
  /** Count-up length in ms (default 600). */
  ms?: number;
  format?: (n: number) => string;
}

/** A number that counts to its new value and pops on each change; the first value shows still. */
export function NumberPop({ value, ms = 600, format }: NumberPopProps): JSX.Element {
  const [from, setFrom] = useState(value);
  const [seen, setSeen] = useState(value);
  const [first] = useState(value);
  if (seen !== value) {
    setFrom(seen);
    setSeen(value);
  }
  const shown = useCountUp(value, from, ms);
  return (
    <span key={value} className={styles.num} data-first={value === first ? '' : undefined}>
      {format ? format(shown) : shown}
    </span>
  );
}
