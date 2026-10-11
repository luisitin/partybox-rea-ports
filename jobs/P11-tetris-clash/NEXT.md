# Resume P11

Runner `r11-local` claimed P11 on main; implementation branch `job/P11-tetris-clash`.
Read RULES.md, JOBS.md, games/block-clash/README.md and this job's verification evidence.

Current milestone: original engine/client, research, fixtures and scoped verification harness built.
Dependencies installed once via `corepack enable` and `pnpm.cmd install`.

Mutation baseline: 44 assertions; 20/20 planted executable bugs caught and reverted.
Unit/property checks passed (1003 seeds); all phase HTML and 12 PNGs generated.
Desktop contention caused the SDK skipper check to exceed its 20-second default;
our scoped contract wrapper now permits 60 seconds. Full test run has a bot-file import
error to diagnose when its output is complete; no passing simulation is assumed yet.

Remaining: full scoped simulation/tests, final typecheck/format; phase capture review; CI and draft PR;
then KEEP GOING until three consecutive rounds have no player-visible gain.

Use `pnpm.cmd` in PowerShell because script execution policy blocks `pnpm.ps1`.
Run only this game's tests. Never launch multiple headless browsers.
Refresh CLAIMS.md on main after pushes; pull --rebase immediately before each claim commit.
