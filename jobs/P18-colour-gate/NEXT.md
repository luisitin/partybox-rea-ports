# P18 handoff

Run: r17-local. Branch: job/P18-colour-gate.

Research and the pure server are implemented. Client and verification are being
completed in this clone. No original assets are copied and no runtime network calls
are used. Next required checks: targeted unit/contract/property tests, bot simulations
at every supported player count, twenty isolated mutations, fixtures and all phase
captures, typecheck and formatting, then draft PR and green CI before ready status.

Only run this game's tests. At most one headless browser, closed in finally.
Refresh the claim on main after every branch push; pull --rebase before its commit.
