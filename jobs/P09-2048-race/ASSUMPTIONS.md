# P09 assumptions and limits

## Current canonical resume (2026-10-12, r1-local)

- Product/id is 2048 at `games/2048`; Merge Sprint was a superseded working name. Job/branch slug stays P09-2048-race. Root checked 117 core manifests and found no overlap.
- Claim `206c2c0` belongs to r1-local. Current public-queue instructions govern main claim commits and the job branch; owner core remains read-only.
- PR #12's old ready/green state is baseline. Reopen as draft until current name/source/capture/testing/CI gates pass; no fresh PASS or DONE is assumed.
- Fresh research opened the original hosted page and independently authored pinned raw engine. No interactive live play/audio session occurred; original durations remain source observations, not observed browser timings.
- Historical 76 tests, 21,000 bots, 20 kills and 15 captures are retained only as prior-run evidence. New reading floors require refreshed timing/completion simulations, and current source requires fresh contract/property/mutation/hash evidence.
- The old capture shell was fake chrome, and spectator SSR used incorrect role routing. Its clean geometry/no-controls claims do not establish actual-host or real spectator behavior. Root is rebuilding pinned-host evidence; client/server repairs remain under verification.
- Joining/rules/countdown remain shell responsibilities; the game starts in play. Default race is 180 seconds; first accepted 2048 ends the race, otherwise score ranks players. Current reveal holds must meet actual visible-text reading floors.
- No original-game/solver code or assets are imported. Capture-only host CSS/fonts, if included, must have their provenance/licence/hash recorded separately; no new runtime dependency is required.

## Historical prior-run assumptions (superseded)

The following records the original r8-local build, including its old name and access/tool
limitations. Current canonical naming and verification status above take precedence.

### Original prior-run record

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
- Chrome's Windows launcher can hand off to a child and exit without forwarding
  DevTools stderr. Two initial capture attempts failed. A process audit found
  leftover capture profiles/processes; only those task-specific processes were
  terminated. Live-process count was verified zero before another launch. The
  helper is being changed to discover DevToolsActivePort and verify actual child
  process cleanup in finally; stale CIM records with HasExited=true are ignored.

- Numeric ID2048 needs the narrowly expanded leading-character validator documented in docs/DECISIONS.md; safe ID length/characters remain bounded. Public SDK phone type lacks pinned host ownSpectatorScreen, so the local phone entry extends its type while preserving the runtime opt-in. Owner core remains read-only.
