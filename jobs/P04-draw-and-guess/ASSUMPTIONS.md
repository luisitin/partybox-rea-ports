# P04 assumptions and research limits

- The owner's explicit public-REA runner instructions govern this clone and job
  queue. The local PartyBox role/manual worktree and board instructions refer to
  the private core-team workflow; no board file or owner's worktree is edited.
- The study concerns Gartic.io's live drawing-and-guessing loop. Gartic Phone is a
  separate telephone-chain game and is not used as P04's rules source.
- Gartic.io's landing page is readable through the web reader, but a direct
  PowerShell HTTP fetch returned 403 on 2026-10-11. Read its official developer
  listing and independent playable-host instructions instead. An unavailable
  public client does not block building the mechanics.
- The official skribbl page and publicly served client were successfully read.
  Neither provides independently verified server scoring arithmetic. PartyBox's
  speed score and drawer reward are original tuning, not an exact source clone.
- Live solo play was attempted through the computer-use browser API. Its visible
  tab creation returned “Browser is not available: iab”; the inventory returned
  `{ apps: [], browsers: [] }`. No browser, room or multiplayer session was
  available through that interface. No live original playtest or measured sound
  playback is claimed. Follow RULES.md's unavailable-web fallback and continue
  building against corroborated written mechanics and the readable client.
- Exact default draw timers, hint schedules and Gartic prompt counts may change
  or depend on settings. Conflicting unofficial descriptions are documented in
  RESEARCH.md. Use the implemented game's README as its timing/scoring authority.
- Touchscreen drawing needs a small set of large controls on a 390×844 phone.
  The original game's larger fill/colourpicker/hotkey toolset is intentionally
  reduced to the P04 brief's few colours/sizes plus recovery controls.
- Difficulty is an authored judgement: easy = immediate silhouette; medium =
  extra identifying detail; hard = compound scene/action or specialized object.
  All 300 prompts are original selections of family-friendly English concepts.
- The shipped deck is also a bot vocabulary. Guessers must use only public
  drawing/mask data and their own attempts. Seeded vocabulary filtering is a real
  deterministic guessing strategy; it is not image recognition and must never
  consult the secret answer.
- Equal drawing opportunities and fixed rotations suit an 8-person living-room
  match better than Gartic's open-ended point goal. Disconnected players cannot
  delay prompt selection, guessing, reveal or completion.
