# Assumptions and deliberate adaptations

- P13 defines obstacle racing and farthest-at-death scoring but not match length.
  Choose three 60-second rounds by default, configurable 1–5, with a 4.5-second
  score beat; the shell supplies the opening rules and countdown.
- Preserve the original nominal 60 Hz speed ramp as event-time math: 360 units/s,
  +3.6 units/s², cap 780. The source adds speed per update; this port must remain
  deterministic regardless of rendering frame rate. The cap is not reached in 60s.
- Replace the source's variable jump height with a fixed tap impulse, 630 units/s
  against 1800 units/s² gravity. Holding jump grants no extra height. Duck is held
  explicitly and visibly; gameplay labels distinguish JUMP from HOLD DUCK.
- Ground rocks teach jump; low flying birds make held duck the easiest response,
  although a safely timed jump can also clear them, as in the original. Birds are enabled
  after 12 seconds rather than the original's speed-8.5 gate, so a short round uses
  both controls. Every lane gets the same seed, spacing and physics.
- The “450-point bird unlock” shorthand is approximate; use Chromium's exact speed
  gate in research. Independent recorded play describes speed beats at each hundred
  points; source code is authoritative for the continuous ramp.
- Use floor(distance/10) as round metres and add them across rounds. A crash freezes
  distance; equal cumulative scores share rank. One surviving runner keeps running
  until a crash or the cap, so an early sole survivor still earns real distance.
- Reconnect restores authoritative pose and score. A missing phone must not block
  the game; disconnect releases duck so a dropped hold cannot latch forever.
- Paused jump/duck presses are ignored, while duck release is accepted to preserve
  the physical release across resume and prevent a stuck crouch.
- Original little comet creatures and neutral rocks/birds replace the original
  dinosaur/desert presentation. All drawings are ours; audio comes from existing
  SDK cues. No source code or assets are reused, and no new dependencies are needed.
- Research used current public Chromium TypeScript modules rather than the older
  monolithic offline.js; equivalent mechanics were read without copying code.
- The first numerical direct-play pass used the wayou historical fork at 390×844
  with touch enabled and measured speed 4.723, rising to 4.837 after a one-second
  wait. This is not the current Chromium base speed of 6. Mobile scaling plausibly
  explains the difference; do not infer a different fork base speed without reading
  it. Its final sample had `crashed: false`, so collision remained unobserved then.
- Evidence of original live play and all verification belongs in VERIFY.md. The
  media observation JSON records numerical state only; no external-source screenshot
  or asset is committed to the public job media folder.
- The Computer Use connector reports an empty browser inventory on r14. Automated
  capture can use the already installed Chromium headless engine, at most one
  browser owned by this runner and always closed in `finally`.
- Team rules for the private PartyBox checkout are superseded here by the owner's
  explicit public-workshop instructions: r14 owns this clone, pushes only claim
  updates to main, and runs the workshop's checks rather than `pb submit`.
