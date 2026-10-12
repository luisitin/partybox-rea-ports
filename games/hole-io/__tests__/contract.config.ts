// Intake and city positions are public. Simulation bookkeeping is never a stage payload.
export const contractConfig = {
  hiddenFromTv: () => ['rng', 'cells', 'inputAt', 'immuneUntil'],
  hiddenFromController: () => ['rng', 'cells', 'inputAt', 'immuneUntil'],
};
