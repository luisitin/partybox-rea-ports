// Optional hints for the shared contract suite (packages/game-sdk/src/contract-tests).
// Nothing in Curve Fever is hidden: the whole arena is on the TV and every phone may see where every worm is. The phones are sent
// less (only their own worm), but that is bandwidth, not secrecy.
export const contractConfig = {
  settingsVariants: [{ rounds: 1 }, { rounds: 6 }],
};
