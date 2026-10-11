# P12 next

Run: r13-local · Branch: job/P12-flappy-lanes

Research, deterministic engine, clients, fixtures and scoped SDK suite implemented.
Latest local assertions: 74/74 before the extra simultaneous off-grid collision regression;
that regression and property checks also pass. Full typecheck passed. Bot tuning now separates
reaction cadence and precision. The 1,000-match-per-count-and-strength simulation and 20 source
mutations are the remaining large checks. Every phase has real React HTML and PNG previews.

Next: finish simulation/mutations, final formatting and scoped tests, record evidence in
VERIFY.md, create PR with the job README as body, wait for CI, run KEEP GOING until three
successive reviews find only cosmetic gains, then claim the next eligible job.

No server is running. Capture browsers are closed in finally; Windows can retain exited process
records until command handles close. Use only this game's tests and one browser at a time.
