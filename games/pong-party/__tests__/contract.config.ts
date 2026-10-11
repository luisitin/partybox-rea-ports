// Ball positions and paddle states are public. The future serve angles and PRNG
// state are server-only: clients must not predict a serve before it exists.
export const contractConfig = {
  hiddenFromTv: () => ['spawnAngles', 'rng'],
  hiddenFromController: () => ['spawnAngles', 'rng'],
};
