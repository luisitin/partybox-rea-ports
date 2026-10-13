# haxball

- README.md is the spec. Two teams play two 90-second halves by default.
- Pure server only: event.now, state.rng, fixed-step physics; no timers or I/O in game code.
- Held movement and kick expire with a short input lease. Kicks arm once per press and require release after firing.
- The public pitch is visible to everyone; intent/sequence metadata belongs only to its owner.
- Odd rosters receive one named helper on the smaller team; helpers are not result participants.
- Original disc/pitch art and content only. Use the SDK design tokens and honor reduced motion.
- Run only this game's tests: pnpm vitest run games/haxball. Root owns desktop checks and the single headless browser.
- Job evidence and resume notes live in jobs/P24-haxball.
