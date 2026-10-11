// Numeric future gate coordinates stay server-side. The public course is the
// visible window only; rules.test.ts also diffs views after hidden-course edits.
export const contractConfig = {
  settingsVariants: [{ rounds: 1 }, { rounds: 6 }],
  hiddenFromTv: () => ['course'],
  hiddenFromController: () => ['course'],
};
