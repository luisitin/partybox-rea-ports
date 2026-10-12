# Resume P24 Haxball

Runner r3-local, branch job/P24-haxball. Draft [PR 17](https://github.com/luisitin/partybox-rea-ports/pull/17).

- Physics milestone `87135fa` passed all 58 focused rules, but full CI `38207797194` failed
  one of 132 tests: two-player sharp bots produced no goals in 333 default matches. Every
  one of 7,000 matches terminated at 188,000 ms. Do not describe this head as green.
- Root trace `.git/p24-sharp-trace.json`, seed 3668342005, reproduces a ball trapped at
  (158,98) in half one and (2,98) in half two. Freeze attribution owns the public-geometry
  strategy fix; preserve solid posts, judged crossings, scoring and positive-goal assertions.
- Round 4 copy is verified: 46 client/SSR tests, 75 static layouts, 67 controls, 64 goal cues
  and 12 retained-credit checks pass. Capture timestamp 2026-10-12T05:33:06.395Z. Browser,
  exact endpoint and temporary profile are closed/removed. Copy explains radial aim and when
  goals switch. Full local final verification has not run after these physics/tactics changes.
- After tactics pass, run all Haxball tests with one worker and PB_WRITE_EVIDENCE=1, then
  the 20 mutation checks sequentially. Keep source immutable during each run and verify source
  restoration plus every media SHA-256 independently. Media must stay strictly below 10 MB.
- Update VERIFY.md and LOOP.md with actual measurements, push and refresh CLAIMS.md on main
  after pulling --rebase. Keep the PR draft until its final exact-head P24 CI is green, then
  finish three actual five-weakness reviews in a row with no player-visible gain.
- Install is complete. Use pnpm.cmd. Root owns tests and at most one headless browser,
  closed in finally. Test only games/haxball. No original live, human LAN, acoustic or
  eight-stranger playtest is claimed. Do not claim a new job before this one is DONE/BLOCKED.
