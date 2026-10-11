// The fountain is public. Per-seat cut histories and raw seeded state stay on the server.
export const contractConfig = {
  hiddenFromTv: () => ['rng', 'seats', 'cut'],
  hiddenFromController: () => ['rng', 'seats', 'cut'],
};
