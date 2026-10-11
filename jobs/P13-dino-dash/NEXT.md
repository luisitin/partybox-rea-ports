# P13 handoff — r14-local

- Branch: `job/P13-dino-dash`; claim on main is held by `r14-local`.
- Research complete: current Chromium source and two independent observations documented.
- Server and phone controls implemented, fixtures generated, actual SDK contract wired.
- Latest focused run: 77/78 passed; the course property exceeded its timeout under shared
  desktop load. Assertion overhead is being reduced without dropping seeds or samples.
- First capture: 26 surfaces and eight live-control scenarios completed. Manual inspection
  found TV lane clipping despite the old bounds check; TV layout and containment checks
  are being repaired before recapture. Browser shutdown stalled; only the owned Chromium
  process was cleaned up. The capture script always requests close in its finally block.
- The 21,000-match seeded simulation is running. Next: finish current checks, real serial
  mutations, final typecheck/format, verified captures and media hashes, then draft PR.
- Browser UI plugin has no surfaces; captures use the already installed Chromium and
  cached playwright-core. No dependency or original asset is added to the game.
- PR must be draft until its P13 CI workflow is green. Run KEEP GOING before claiming the next job.
