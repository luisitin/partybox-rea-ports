# P14 handoff

Run: r10-local. Branch: job/P14-crossy-streets. Claim pushed on main.

Research, deterministic server, original SVG UI, final phase fixtures and verification are complete. The full scoped suite passes 55 tests; 7,000 seeded games terminate; the recorded mutation run catches 20/20 with a green restored baseline; twelve final screen captures fit and were inspected. Evidence is in VERIFY.md and JSON reports.

Remaining: final format check and media hashes, draft PR and scoped CI, then KEEP GOING improvements until three consecutive rounds have no player-visible gain. Review priorities: off-map TV racer status, explicit result rank on phones, accepted-hop feedback and shared-cell visibility.

Dependencies installed once through pnpm.cmd. Use Git Bash, `login:false`, a TTY and one thread worker on this Windows runner; command shims and pipe-only sessions were slow to terminate. Simulators use direct Node/tsx and exit after persisting evidence. No local server is needed. Capture uses one disposable browser with unconditional CDP close.
