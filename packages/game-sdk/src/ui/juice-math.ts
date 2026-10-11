// The juice layer's pure half (T-0341): where each particle of a burst goes. Deterministic from (kind, count,
// seed), so a burst looks the same on the TV, on a phone and in a test; no Math.random, no clock.
export const JUICE_KINDS = ['sparks', 'coins', 'confetti', 'dust'] as const;
export type JuiceKind = (typeof JUICE_KINDS)[number];

export interface Particle {
  /** Where it flies to, px from the burst's origin (before gravity). */
  dx: number;
  dy: number;
  /** How far it sags by the end, px (gravity; negative for dust, which floats up). */
  fall: number;
  rot: number;
  scale: number;
  /** Start delay, ms. */
  delay: number;
  /** 0..3: which accent token paints it. */
  tone: number;
}

interface Shape {
  count: number;
  /** Radius range, px. */
  reach: [number, number];
  /** Cone: centre angle (deg, 0 = right, -90 = up) and width; 360 = all round. */
  aim: number;
  spread: number;
  fall: number;
  ms: number;
  spin: number;
}

export const SHAPES: Readonly<Record<JuiceKind, Shape>> = {
  sparks: { count: 18, reach: [60, 180], aim: -90, spread: 360, fall: 40, ms: 700, spin: 0 },
  coins: { count: 12, reach: [90, 260], aim: -90, spread: 120, fall: 220, ms: 1100, spin: 720 },
  confetti: { count: 36, reach: [120, 380], aim: -90, spread: 150, fall: 320, ms: 1800, spin: 540 },
  dust: { count: 8, reach: [20, 70], aim: -90, spread: 180, fall: -30, ms: 800, spin: 0 },
};

/** A small seeded stream (mulberry32): a burst's look is a function of its seed alone. */
function stream(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string's seed (a moment's key), so the same moment always bursts the same way. */
export function seedOf(key: string | number): number {
  if (typeof key === 'number') return key;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function particlesOf(kind: JuiceKind, seed: number, count?: number): Particle[] {
  const s = SHAPES[kind];
  const next = stream(seed);
  const n = Math.max(0, Math.min(120, Math.round(count ?? s.count)));
  return Array.from({ length: n }, () => {
    const angle = ((s.aim + (next() - 0.5) * s.spread) * Math.PI) / 180;
    const r = s.reach[0] + next() * (s.reach[1] - s.reach[0]);
    return {
      dx: Math.round(Math.cos(angle) * r),
      dy: Math.round(Math.sin(angle) * r),
      fall: s.fall,
      rot: Math.round((next() - 0.5) * 2 * s.spin),
      scale: Math.round((0.6 + next() * 0.8) * 100) / 100,
      delay: Math.round(next() * 90),
      tone: Math.floor(next() * 4),
    };
  });
}

/** How long a burst of this kind lives, ms (its longest particle included). */
export const burstMs = (kind: JuiceKind): number => SHAPES[kind].ms + 90;
