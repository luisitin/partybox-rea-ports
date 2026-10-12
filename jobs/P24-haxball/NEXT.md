# Resume P24 Haxball

Runner r3-local, branch job/P24-haxball. Draft [PR 17](https://github.com/luisitin/partybox-rea-ports/pull/17).

- Current final physics/tactics source passes all 67 rules: original rules, solid posts,
  judged crossing priority/sweeps, eight corner recoveries and repeated kickoff opportunities.
  Strict contact geometry, clocks, scoring, intent leases and external bot RNG remain intact.
- New public-geometry banks clear trapped corners. Near contact uses the real ball; goals and
  halftime rotate dribble angles. Retained known-seed traces show 0–0 trapped, 0–24 bank-only,
  then 12–12 with style rotation. This is a diagnostic, not competitive parity evidence.
- Physics milestone CI 38207797194 failed 131/132 due to zero sharp two-player goals. The
  bank-only two-player 1,000-match probe now passes, but final rotating tactics still need the
  full scoped test run. Run PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/haxball with one worker.
  Expect 141 tests / 7 files, including 7,000 matches (1,000 at every count 2–8) and 1,003 seeds.
- After the full run, execute the 20 mutations sequentially with source frozen. Independently
  verify restored source hashes and every media SHA-256, total strictly below 10 MB.
- Latest client evidence: 46 focused tests, 75 layouts, 67 controls, 64 goal cues and 12 retained
  credit checks. Capture 2026-10-12T05:33:06.395Z; browser/endpoint closed, profile removed.
  Compare canonical final generated HTML with this captured revision; recapture only if changed.
- Update VERIFY.md/LOOP.md with actual results. Then finish three actual five-weakness reviews
  in a row with no player-visible gain. Keep the PR draft until final exact-head P24 CI is green.
- Push milestones, refresh CLAIMS.md on main after pulling --rebase, and keep this file current.
  Install is complete. Use pnpm.cmd; root owns only this game's tests and one headless browser,
  closed in finally. No original live, human LAN/eight-stranger, acoustic or parity test claimed.
  Do not claim another job until this one is DONE/BLOCKED.
