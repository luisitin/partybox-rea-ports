# P18 handoff

Run: r17-local. Branch: job/P18-colour-gate.

Research, the pure server, TV/phone clients and phase fixtures are implemented.
The initial targeted run passed 50 tests including the stock SDK contract suite.
After hover tuning and stale-VIP guarding, focused lifecycle/physics checks passed
25 tests. Typecheck passed. Reduced 20-seed normal/easy bot runs finished at every
count 2-8 in 153 seconds per match (45 seconds per round).

Still required: full 1,000-seed bot runs, twenty isolated mutation runs, regenerated
fixtures after tuning, the final targeted suite, all phase capture/fit checks,
formatting, a draft PR, green CI and the KEEP GOING review loop. Vitest reported
passing assertions but Windows teardown sometimes lingers with open file handles;
timeouts must never count as successful mutation detection. The verification tools
record a completed-run marker before explicitly exiting where needed.

Only run this game's tests. At most one headless browser, closed in finally.
Refresh the claim on main after every branch push; pull --rebase before its commit.
