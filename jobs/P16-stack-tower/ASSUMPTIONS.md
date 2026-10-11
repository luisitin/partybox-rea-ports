# Assumptions

- The owner's explicit REA runner workflow overrides the older PartyBox team workflow for this public clone: work in r16, commit only claim updates on main, and open PRs with gh. The team board does not register this clone.
- PowerShell execution policy blocks pnpm.ps1; commands use pnpm.cmd. Corepack enabled and dependencies installed once. No dependencies added.
- Exact original perfect tolerance is unavailable. PartyBox uses 2.6 world units or 6% of the active dimension, whichever is smaller. This is an original tuning choice, not a claim about the original.
- Three consecutive perfect placements start regrowth of 8 units on the active axis, capped at the original 80. Height alone scores. These are PartyBox choices.
- A 45-second race allows retries and retains each player's best height; no bonus changes the height ranking. This prevents early misses leaving players idle.
- The shell owns rules/ready/countdown. This port starts directly in play, as the published contract requires.
- The public clone has no gen-registry, sim or verify scripts described by older folder guidance. Equivalent per-game tests and tools are provided here without modifying shared infrastructure.
- Moving blocks are essential game information. Reduced motion disables decorative effects while retaining the measured slider so timing remains playable.
