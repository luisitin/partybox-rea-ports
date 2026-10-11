# P12 — Assumptions and limitations

- This is the public PartyBox REA ports workshop in `C:/dev/rea-runs/r13`.
  The owner's explicit queue, CLAIMS.md, push and PR instructions govern this
  run. The separate core-team worktree and `pb` workflow do not apply to this
  authorized public-repo task.
- PowerShell script execution blocks the installed `.ps1` package-manager
  launchers on this PC. Use `corepack.cmd` and `pnpm.cmd` for the owner's
  requested one-time install and subsequent commands.
- `games/AGENTS.md` refers to `docs/ADDING_A_GAME.md` and `pnpm gen-registry`.
  The guide and generator are absent from this published SDK clone; there is
  no private app registry to modify. Use the actual README/RULES.md commands
  and the owner's game-scoped test limit instead of the missing workflow.
- The original mobile game was not available for firsthand play here. Public
  technical recreations and a contemporary firsthand review establish the
  mechanics and feel. The port does not claim a direct play session or exact
  original fidelity.
- The creator's Rolling Stone interview returned HTTP 402 and the Gamelab
  Vimeo embed returned HTTP 404. Other reachable sources allowed research to
  continue; these access failures do not block the job.
- No exact mobile-original impulse, gravity, gap spacing, collision mask,
  music, or cue timing was proven. All numeric flight and course parameters
  in the spec are deliberate PartyBox approximations. Clone parameters are
  labelled comparison evidence only.
- Three rounds are the P12 default; the manifest exposes `rounds` from 1 to 6.
  The common seeded course, round cap and survival scoring are fixed. Three
  capped rounds take at most 159 seconds and six take 318 seconds, within
  twice the three-minute estimate. Gate passage `passed` counts measure
  progress, while the match score rewards survival order. Crashes on the
  same physics sample tie, and racers still alive at the cap tie.
- Reconnect means continuing the existing lane's state, not restoring a
  pre-disconnect safe position. Physics continues without inputs during a
  drop, and the round never waits on a missing controller.
- Bots may inspect only public current flight state and the next gate inside
  the visible horizon. They may not use hidden future seeded gate centres.
  They act through externally polled `bot.sampleInput`, without autonomous
  ticks. The job's simulation polls every 100 ms; engine polling cadence is
  an integration consideration rather than a game-owned timer.
- Original gliders and arches replace the source game's character and pipes.
  No copied art, audio, music, fonts, logos, or trademarks are shipped as art
  or as the game name; research attribution still identifies the source game.
- No new dependencies, tracking, secrets, or runtime external network calls
  are needed. Content is a seeded course, with no question or word packs.
- Windows retained the initial capture profile despite the exact browser tree
  being closed. The debugger endpoint is unreachable and no capture Chrome
  process remains. The capture tool now creates a unique OS-temporary profile;
  an EPERM/EBUSY cleanup failure is logged after closing the browser. The old
  clone-local profile is excluded from Git and formatting.
