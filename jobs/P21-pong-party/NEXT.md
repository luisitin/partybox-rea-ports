# Handoff — r20-local

- Claimed P21 on main; implementation branch `job/P21-pong-party`.
- Dependencies installed; primary-source research recorded.
- Engine and UI implemented; scoped tests and 20-mutation runner drafted. Initial checks are running; no simulation/property/mutation success claimed yet.
- Fixed two meaningful pre-verification issues: rotating re-serves reach all eight edges; bot moves stop jittering at the same physics sample so SDK timers cannot starve.
- Static rendering covers three phases in five TV/phone/spectator variants. Browser fit measurements and hashes are pending.
- Before PR: integrate, typecheck/format, game contracts, 3,000 bot simulations, 1,003 property seeds, 20 mutation checks, every screen capture, media hashes, and scoped CI.
- After green draft PR: run and measure KEEP GOING improvements, then three no-noticeable-gain rounds before marking DONE.
