# P05 handoff

Branch: job/P05-blob-arena. Runner: r5-local. Claim on main.
Installed with corepack enable + pnpm.cmd install (PowerShell blocks pnpm.ps1).

Research, server, client, fixtures and job-specific workflow are implemented.
Quick validation: 104 tests passed with PB_SIM_RUNS=1; typecheck green.
Mutation validation: 20/20 intentional behavioral bugs caught, original bytes restored.
Nine phase/surface screens captured at TV1920x1080 and phone390x844.
After visual fixes, viewport clipping and TV score text overlap are both zero.
The owned browser closed; Node's Windows child handle required terminating the idle
capture process. capture.mjs now explicitly exits after its finally cleanup.

Currently running: full game's Vitest suite, 1,000 matches at every count2–8,
cycling easy/normal/sharp. Do not start another heavy simulation or browser.
VERIFY.md records measured checks. Remaining: full test result, merge current main
(shared CLAIMS formatting ignore), final format, draft PR + green CI, KEEP GOING.

Post-green audit candidates: equal joystick reach across modes; visible respawn
protection; four-piece merge guidance; score countdown; crowded labels / long ties.
No interactive original gameplay or original audio was observed; access limits
are documented and original source code/assets are absent from the repository.
