# P07 assumptions and limits

- The owner's public REA runner instructions govern this clone and queue. The
  PartyBox core-team worktree/board workflow is not used to claim this public job.
- The old `paper-io.com` URL redirects to Voodoo's current marketing/support
  landing page. Official support and developer release notes remain readable.
- `paperio.site/app2.js?v7` was reachable and inspected read-only. Its self-reported
  2020 build identity is not authentication of mirror ownership or fidelity to the
  current official game. Its code/assets are not included in the repository.
- Browser UI tooling had no available app/browser surfaces when checked in this
  runner session. No original live play, sound listening or multiplayer collision
  experiment is claimed. A separate isolated browser later captured our authored
  screens, and was closed after each capture. Written primary
  instructions, independent observations and readable client text are the fallback.
- Older browser instructions make own-trail crossing fatal, while Voodoo's mobile
  4.33.0 notes make it nonfatal. The June 13 year is inferred as 2026 from the
  release-history sequence following December 2025. PartyBox chooses the classic
  fatal-self-trail variant and says so explicitly.
- Official public material does not specify exact corner topology or simultaneous
  collision priority. PartyBox authors deterministic rules: four-neighbor fill;
  cuts before captures; shared head cells/head swaps kill; contested simultaneous
  capture cells neutral. Tests must verify those choices rather than claiming an
  unobserved original result.
- The rectangular grid, four phone directions, fatal walls, protected 3×3 homes,
  three-second respawn and current-area score at a 120-second buzzer are deliberate
  living-room adaptations. They are not asserted to be current mobile or browser
  rules. Opponents can traverse homes but cannot capture them.
- A disconnect clears active trail and expanded land without incrementing deaths;
  reconnect can spawn again and permanent departure cannot respawn. No phase may
  wait on a missing phone.
- The historical 2018 analysis's bots and limited camera view cannot establish
  current networking or player populations. PartyBox has actual local human seats
  plus explicitly marked deterministic bots and one shared full-arena view.
- Source timing/speed/audio were not measured. Game tuning must be documented as
  authored values in the final README, and simulation measurements in VERIFY.md.

- Main JOBS/RULES owner update 10-11 (pulled at e351af0) requires the official name Paper.io 2 and id `paper-io`. The game folder, manifest, rendered strings, SDK id and active commands follow that update. The existing branch/job-folder slug is retained for PR/claim continuity. Historical verification files retain their tested `paper-territory` paths and hashes.
- Read-only overlap check on 2026-10-12: `C:/dev/partybox` contains 110 game manifests and 110 generated server-registry ids. No Paper.io, Paper Territory or matching id occurs in games, docs/games or either generated registry. Curve Fever has survival trails rather than territory capture, so P07 remains a new port.
