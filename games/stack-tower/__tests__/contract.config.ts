// Towers, motion course, floors and all scores are public. Only the internal RNG stays private.
// Direct view-diff tests additionally prove that changing RNG cannot change either projection.
// Check the internal key: numeric seed values may also occur in legitimate public timestamps.
const rngSecret = (): string[] => ['rng'];

export const contractConfig = {
  hiddenFromTv: rngSecret,
  hiddenFromController: rngSecret,
};
