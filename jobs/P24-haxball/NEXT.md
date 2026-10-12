# Resume P24 Haxball

Runner r3-local, branch job/P24-haxball. Draft [PR 17](https://github.com/luisitin/partybox-rea-ports/pull/17).

- Final physics/tactics source `ad9ba08` is green: 141 tests / 7 files, 540.29 s, including
  7,000 default matches at every count 2–8, 1,003 property seeds and the real SDK contract.
  All matches end at 188,000 ms; every strength scores. CI 38210012575 passes on this source.
- A final client-only repeat guard prevents cancelled keyboard controls from reviving after
  pause, goal/new play or blur. Latest 46 client/SSR tests and 88 mounted controls pass,
  alongside 64 goal-cue and 12 retained-credit checks. Final capture is 06:09:30.492 UTC.
- Browser/process/endpoint closure is verified; Windows can retain exited records and an
  EBUSY temporary profile, but no owned active browser remains. All 75 final canonical HTML
  pages are identical to the static captures; TV/phone fit evidence stays valid.
- Refreshed mutations pass 20/20, zero invalid/surviving. Independent SHA-256 verification
  matches all four restored game files. Run hash-media.mjs and independently verify every
  media hash after evidence changes; keep the folder strictly below 10 MB.
- Round 7 touch replay fix is implemented; 46 focused client/SSR tests pass (4.74 s).
  Final capture at 06:54:04.963 UTC passes all 104 controls, 64 goal cues and 12 credit checks.
  Two intermediate heartbeat timing failures (472 ms, then 849 ms) are retained. Foreground
  browser automation flags/GPU resolve the final capture; game timing and assertions stay fixed.
  Browser/native endpoint closure passes, zero forced processes; the profile is removed.
  Touch milestone a278579 CI failed only two generated JSON formatting checks, now corrected.
- Next: wait for exact-head touch-source CI, then perform three actual
  five-weakness reviews in a row with no player-visible gain. Log/push each review and refresh
  CLAIMS.md on main after pulling --rebase. Final latest-head CI must be green before PR ready.
- After that, mark P24 r3-local DONE on main, with pull --rebase before its claim commit.
  Revalidate the lowest eligible queue job; no other r3-local claim is unfinished (P03 DONE).
- Install is complete. Use pnpm.cmd; root owns only this game's tests and at most one headless
  browser, closed in finally. Source stays frozen during tests/mutations. No original live,
  human LAN/eight-stranger, acoustic or competitive parity playtest is claimed.
