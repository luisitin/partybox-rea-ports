// Pure, counter-based PRNG (ADR-019). State is `{ seed, step }` so it can live inside JSON game
// state; every draw returns `[value, nextState]` and never mutates. `createRng` wraps the same
// generator in a mutable object for code that lives OUTSIDE game state (bots, the sim, the server).

export interface RngState {
  seed: number;
  step: number;
}

/** Mutable convenience wrapper — never store one of these in game state. */
export interface Rng {
  float(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  chance(probability: number): boolean;
  state(): RngState;
}

const TWO_POW_32 = 4294967296;

/** 32-bit mix of (seed, step): murmur3 finalizer over a golden-ratio stride. Good enough for games. */
function mix(seed: number, step: number): number {
  let h = (seed ^ Math.imul(step + 0x632be5ab, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  // second round decorrelates neighbouring seeds
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

export function seedRng(seed: number): RngState {
  return { seed: seed >>> 0, step: 0 };
}

/** Uniform float in [0, 1). */
export function nextFloat(rng: RngState): [number, RngState] {
  return [mix(rng.seed, rng.step) / TWO_POW_32, { seed: rng.seed, step: rng.step + 1 }];
}

/** Uniform integer in [min, max] (inclusive). `max < min` returns `min`. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  const [f, next] = nextFloat(rng);
  const span = Math.max(0, Math.floor(max) - Math.ceil(min) + 1);
  return [Math.ceil(min) + Math.floor(f * span), next];
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(rng: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, 0, i);
    state = next;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return [out, state];
}

/** One item; throws on an empty list (a game must never ask). */
export function pick<T>(rng: RngState, items: readonly T[]): [T, RngState] {
  if (items.length === 0) throw new Error('pick: empty list');
  const [i, next] = nextInt(rng, 0, items.length - 1);
  return [items[i] as T, next];
}

/** Deterministic 32-bit hash of a string (FNV-1a) — handy for deriving seeds from names. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let state = seedRng(seed);
  const rng: Rng = {
    float: () => {
      const [v, next] = nextFloat(state);
      state = next;
      return v;
    },
    int: (min, max) => {
      const [v, next] = nextInt(state, min, max);
      state = next;
      return v;
    },
    pick: (items) => {
      const [v, next] = pick(state, items);
      state = next;
      return v;
    },
    shuffle: (items) => {
      const [v, next] = shuffle(state, items);
      state = next;
      return v;
    },
    chance: (p) => rng.float() < p,
    state: () => state,
  };
  return rng;
}
