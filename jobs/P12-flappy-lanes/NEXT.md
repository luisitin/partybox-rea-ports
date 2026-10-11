# P12 next

Run: r13-local · Branch: job/P12-flappy-lanes

Research, engine, clients, fixtures and verification are complete. Local types and formatting
pass; scoped game + real SDK tests pass 76/76. Full simulation: 21,000/21,000 matches terminate
within 159 s; mutations: 20/20 caught, originals restored and hashed. Twelve real React screen
captures fit the required viewports; media hashes are current.

Next: open the draft PR with this job README as body, wait for green CI, then run KEEP GOING.
Priorities: live stage after a phone-only crash, next-round readiness, explicit winners/ties,
flight visibility and essential reduced-motion tracking. Stop that loop only after three
consecutive reviews find no player-visible gain, then claim the next eligible queue job.

No server or capture browser is running. Use only this game for tests, one worker, and at most
one headless capture browser, closed in finally. Initial clone-local capture profile cleanup
was blocked by automatic review; it is ignored. Later captures use unique OS-temp profiles.
