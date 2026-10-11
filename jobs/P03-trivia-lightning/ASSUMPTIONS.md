# P03 — Assumptions and research limits

- The owner's explicit public REA assignment authorizes work in `C:/dev/rea-runs/r3`, branch
  `job/P03-trivia-lightning`, and CLAIMS.md coordination on this repository's main. PartyBox's
  separate team-v2 worktree/queue rules do not replace this authorized public workflow.
- P01's quiz pack schema was not merged when P03 was claimed. P03 defines a compatible local
  pack boundary: stable question IDs, a prompt, four choices, one correct index and explanation;
  integration with a future P01 schema may need a mechanical adapter.
- Rules labelled PartyBox adaptations in RESEARCH.md are deliberate product choices. The finite
  shared-seed race, 100 base points, capped streak, energy per three correct, three-second rival
  freeze and next-correct doubling are not claimed to be Quizizz or Gold Quest constants.
- The current Quizizz URLs serve Wayground branding and the same join bundle. Research uses
  current vendor documentation alongside independently authored historic usage reports.
- Direct Blooket join/Gold Quest HTTP requests returned 403. Its accessible official help page,
  web-readable join surface and independent classroom recordings were used as fallbacks.
- No existing stranger's room was joined, no account was created, and no complete live original
  multiplayer session was played. Research is grounded in official documentation, public client
  inspection and firsthand published recordings; the gap is disclosed rather than implied away.
- A visitor practice session was attempted with computer-use: the in-app browser was unavailable
  and the enabled surface inventory returned no browsers/apps. That UI path could not close the
  original-live-play gap; the fallback did not require creating an account or joining strangers.
- Historical Gold Quest accounts describe a three-chest choice and varied rewards. Current
  probabilities, exact reward values, swap availability and original audio timings are unverified.
  Conflicting unaffiliated 2026 guides were not used as authoritative evidence for a rework.
- B2's approximately three-second wrong-answer delay is a historical single observer's report,
  not a measured current fact. The port's own pacing must be measured in VERIFY.md.
- Quizizz's Time Freeze applies to the player's answering timer. P03's rival freeze has a
  different, explicit rule; it is not presented as a faithful copy of that ability.
- Source question text, artwork, bundles and audio are not copied. The local game has no runtime
  network dependency on the researched products. Public bundles were read transiently only.
- CPU care follows the owner's override: this game's tests only, no whole-suite browser run,
  and no more than one headless browser, closed in a finally block by the runner.
- This public snapshot has no `docs/ADDING_A_GAME.md`, `gen-registry` script or `verify` script.
  The available checks are `pnpm typecheck`, `pnpm format` and the owner's explicitly scoped
  `pnpm vitest run games/trivia-lightning`; those replace the absent internal repository commands.
