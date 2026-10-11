# Assumptions

- The owner's explicit public-port instructions override the PartyBox main-repo
  board, worktree, role/model and main-push restrictions for this clone.
  The claim is the only intended change on main; game work is on its job branch.
- P09's reference product name becomes **Merge Sprint**; `2048` stays the numerical
  target. `games/merge-sprint` is the manifest id; queue branch stays P09-2048-race.
- The race starts directly in play because the SDK shell already gives rules,
  ready-up and countdown. No extra in-game ready phase.
- Fairness means identical initial boards and identical value/location-rank draws
  at the same successful move index, rather than identical occupied cells after
  players choose different moves. No-ops consume no draw.
- A first target-winning accepted input closes the race immediately. Equal
  arrival timestamps still follow the engine's deterministic event order.
- At the clock or a host stop, merge score alone ranks racers; ties share rank.
  A target finisher outranks non-finishers even with a lower merge score.
- A 150 ms accepted-move interval and move version prevent duplicate delivery and
  accidental double gestures. A theoretical 1,200-move cap bounds memory/use.
- Refresh restores the server board and move number. Disconnected players keep
  their scores; the race clock continues and never waits for their input.
- `pnpm.ps1` is blocked by machine policy; use the existing `pnpm.cmd` shim.
- Original visible-browser play was attempted, but computer-use reported no
  browsers or apps. Original engine play/probes used an ephemeral Node VM;
  no visual/audio playthrough is claimed. Static port captures remain required.
- The public repo has no shell server or gen-registry/verify scripts. Use the
  published entry points, isolated SDK contract suite and binding RULES commands.
