// Boards already played are public; future draws and the RNG are private in every phase.
export const contractConfig = {
  hiddenFromTv: () => ['spawns', 'rng'],
  hiddenFromController: () => ['spawns', 'rng'],
  settingsVariants: [{ seconds: 60 }, { seconds: 120 }],
};
