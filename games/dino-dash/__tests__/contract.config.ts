export const contractConfig = {
  settingsVariants: [{ rounds: 1 }, { rounds: 5 }],
  // Numeric future obstacles stay in server-only course; the actual SDK checks these keys.
  hiddenFromTv: () => ['course', 'rng'],
  hiddenFromController: () => ['course', 'rng'],
};
