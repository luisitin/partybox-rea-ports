# Resume P11

Runner `r11-local` claimed P11 on main; implementation branch `job/P11-tetris-clash`.
Read RULES.md, JOBS.md, games/block-clash/README.md and this job's verification evidence.

Current milestone: original engine/client, research, fixtures and scoped verification harness built.
Dependencies installed once via `corepack enable` and `pnpm.cmd install`.

Mutation baseline: 44 assertions; 20/20 planted executable bugs caught and reverted.
Unit/property checks passed (1003 seeds); all phase HTML and 12 PNGs generated.
Desktop contention caused the SDK skipper check to exceed its 20-second default;
our scoped contract wrapper now permits 60 seconds. Bot helper resolution is repaired.
The 1,000 two-player matches completed (median live round 120s, total including reveal
126s); that baseline run was interrupted for a placement-search optimization. No complete simulation pass is assumed.
At 22:18 UTC the single bot worker had used about 88 seconds CPU in 13 minutes wall time.
Types and formatting pass. Placement-mask optimization matches the preserved original on 3,000 seeded comparisons and fixture/empty boards. Full scoped tests are running; SDK contract now passes20/20.
All phase captures were manually reviewed; 27 media files total about 2 MB and have hashes.

Remaining: full scoped simulation/tests, final format; CI and draft PR;
then KEEP GOING until three consecutive rounds have no player-visible gain.

Use `pnpm.cmd` in PowerShell because script execution policy blocks `pnpm.ps1`.
Run only this game's tests. Never launch multiple headless browsers.
Refresh CLAIMS.md on main after pushes; pull --rebase immediately before each claim commit.
