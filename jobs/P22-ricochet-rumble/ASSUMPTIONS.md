# P22 assumptions and access limits

- The owner explicitly authorized this public repo, r1-local claims and job branches. The unrelated
  PartyBox worktree/board procedure is not used for the REA queue.
- Original live play was attempted through CUA. Creating an in-app browser tab failed with
  `Browser is not available: iab`; the subsequent inventory returned `apps: []`, `browsers: []`.
  No browser was started. Public HTML and its public bundle were reachable with HTTP 200,
  and independent authors' repositories were readable, so this is not a blocked job.
- No original live round, screen transition or audio was observed. Timings and sound feel are
  reconstructed from source descriptions; they must never be reported as live measurements.
- O2 exposes a three-count start, 0.5-second countdown increments, a three-second finish delay,
  a 3–8-second crate interval and a sixty-second classic storm threshold. These are single-source
  constants, not verified user-visible durations or requirements for this port.
- The source implementations disagree on lifetime and weapon inventory. Use only paired common
  mechanics; Burst (spread shot), Beam (fast laser family), Seeker (homing family), five rounds and
  a default forty-five-second cap are explicit PartyBox adaptations.
- The owner naming update on main (RULES/JOBS, fetched2026-10-12) supersedes the initial working title. The official name Tank Trouble and id tank-trouble are used; all art remains authored. The existing job folder and branch slug remain stable for handoff.
- Eight players need a wider, connected maze, visible tank numbers/heading arrows and bounded
  projectile counts. Exact grid dimensions, movement speed, reload, powerup cadence and cap are
  authored balance parameters to validate with simulations and captures, not copied measurements.
- A hard round cap and explicit draw prevent hidden/disconnected players from delaying the room.
  Disconnected control is neutralized; a refresh restores the current seat and public arena. The
  implementation must document whether a permanent leave eliminates the tank immediately.
- Bots use public walls, tanks and projectiles; three strengths vary lookahead, reaction and aim.
  Bot fairness and useful match duration must be measured rather than inferred from an algorithm.
- Sound uses existing SDK cues/bed facilities only. Suggested shot, bounce and explosion contrasts
  express design intent; no original recording or unmeasured loudness claim is shipped.

- Owner-required overlap check inspected C:/dev/partybox game manifests and docs/games. No Tank Trouble/tank-trouble counterpart exists, so P22 remains a new game. Existing Lightning Round and Big-Top Quiz are separate quiz games; P01 follow-up needs the owner naming/overlap instruction applied on its next push.
