// Arena positions are public. PRNG state and the server's control/timer bookkeeping are not views.
export const contractConfig = {
  hiddenFromTv: () => ['rng', 'controls', 'respawns'],
  hiddenFromController: () => ['rng', 'controls', 'respawns'],
};
