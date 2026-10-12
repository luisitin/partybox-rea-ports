# P22 verification

Run r1-local, Windows 11, Node 24, pnpm 12.4.2. The full game suite, final mutations, current screen recapture and types passed. PR CI is pending.

No whole-suite run is authorized. Local game tests use a single thread worker.

| Check                            | Exact command                                                                                                                                                                                                                                                  | Result                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Install once                     | `corepack enable`; `pnpm.cmd install`                                                                                                                                                                                                                          | Completed during P01 in this clone; pnpm 12.4.2 reused, no new dependencies                                                           |
| Types                            | `pnpm.cmd typecheck`                                                                                                                                                                                                                                           | PASS, exit0 after route optimization and official-name migration                                                                      |
| Focused behavior/fixtures        | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/generate.test.ts --maxWorkers=1 --pool=threads`                                           | Initial 53 tests PASS; final-winner regression subsequently added                                                                     |
| Final lifecycle/SDK/SSR/fixtures | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/sdk.test.ts games/tank-trouble/__tests__/generate.test.ts games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads` | PASS: 62 assertions, exit 0, 14.62 s                                                                                                  |
| Required game run                | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/tank-trouble --maxWorkers=1 --pool=threads --reporter=verbose`                                                                                                                                          | PASS: 106 tests, exit 0, 1547.43 s; 1003 property seeds and 7000 complete matches at every count 2..8                                 |
| Formatting                       | `pnpm.cmd exec prettier --write games/tank-trouble jobs/P22-ricochet-rumble .github/workflows/P22.yml`; `pnpm.cmd format`                                                                                                                                      | PASS, exit0; generated fixtures and all final evidence formatted after generation/capture                                             |
| Static screens                   | opt-in `screens.test.tsx` command above; `node jobs/P22-ricochet-rumble/capture.mjs`                                                                                                                                                                           | PASS:43 final SSR/SDK tests (14.17s), then40 captures of current fixtures, exit0, zero fit failures; ownedPID108768 closed in finally |
| Media hashes                     | `node jobs/P22-ricochet-rumble/hash-media.mjs`                                                                                                                                                                                                                 | PASS:90 files,4683051 bytes, every media file SHA256 recorded                                                                         |
| CI                               | `.github/workflows/P22.yml`: install, types, format, this game's tests, Ubuntu, read-only, 30 min                                                                                                                                                              | Pending PR                                                                                                                            |

The SDK suite is imported unchanged by `sdk.test.ts` with discovery restricted to this one game.
Properties use seeds 1, 2, 3 and 1000 independently sampled reproducible seeds, checking every
event's immutable state and byte-identical replay, JSON-safe values, view checkpoints and phase
transitions. The initial redundant per-event view scans took 299.14 s under shared load and hit
their old timeout; the final implementation passed in 80.27 s without weakening state/replay
checks. Timeouts allow shared-desktop contention; simulated termination budgets remain strict.

Prior failed attempts exposed overlong manifest instructions, signed zero in bot steering,
short reading budgets, the last-round winner leaking into the final headline, and a CSS-module
stub mapping bug in the evidence harness. All were repaired with behavioral/render regressions.
One obsolete full run was terminated only at its verified owned test process (PID 66068), after
later source fixes made its transform cache obsolete; it is not counted as a green check.

## Screen measurements

All forty final frames use actual components, server views and reconstructed CSS modules;
phones reserve an 84 px shell header and 48 px footer. TV body text is at least **32.4 px**,
the game clock is **96 px**, and the smallest phone button is **74.34 × 60.47 px**. Long result
names are fully visible in the TV's two-column ranking and on phones. Paused controls are
disabled and spectators receive no buttons. All phases and tied/long-name/paused/eliminated
variants were independently inspected by hand.

Captures used one owned headless browser at a time, closed in `finally`. Final PID108768 was
verified closed. Windows denied cleanup of its already-closed temporary directory; no other
process or profile was touched. There was no whole-suite browser run.

## Mutation evidence

`node jobs/P22-ricochet-rumble/mutate.mjs --check` passed: all twenty semantic anchors are
unique after formatting normalization; no source changed and no test ran in this check mode.

`node jobs/P22-ricochet-rumble/mutate.mjs` exited **0**. The unmodified focused baseline passed
**54 tests** (36 physics/scoring, 18 lifecycle/view). Each mutation then ran only its relevant
test file with `--maxWorkers=1 --pool=threads --reporter=json --outputFile=<temporary report>`.
**19/20** were caught by behavioral `AssertionError` failures; zero load, syntax, worker,
timeout or unexpected runtime failures were counted. No assertions were weakened.

All six touched source files were restored byte for byte in `finally`. A separate SHA256
comparison against the recorded originals found **zero mismatches**. Full individual failures,
commands and hashes are in [media/mutation-results.json](media/mutation-results.json).

| Mutation | Planted behavior defect                         | Result                                                          |
| -------- | ----------------------------------------------- | --------------------------------------------------------------- |
| M01      | Vertical wall does not reflect X velocity       | Caught                                                          |
| M02      | Horizontal wall does not reflect Y velocity     | Caught                                                          |
| M03      | Tank drives through a blocking wall             | Caught                                                          |
| M04      | Owner muzzle-clearance grace removed            | Caught                                                          |
| M05      | Sixth simultaneous owner shell allowed          | Caught                                                          |
| M06      | Shell lifetime doubled to twenty seconds        | Caught                                                          |
| M07      | Ordinary reload removed                         | Caught                                                          |
| M08      | Beam ricochets instead of wall absorption       | Caught                                                          |
| M09      | Burst loses its two spread projectiles          | Caught                                                          |
| M10      | Beam slowed to ordinary shell speed             | Caught                                                          |
| M11      | Seeker activation delayed past expiry           | Caught                                                          |
| M12      | Tied pickup favors the first roster seat        | Caught                                                          |
| M13      | Catch-up runs after the final-survivor lock     | Caught                                                          |
| M14      | A round win awards two points                   | Caught                                                          |
| M15      | Multiple cap survivors each get a win point     | Caught                                                          |
| M16      | Eliminated tanks also get a round point         | Caught                                                          |
| M17      | Stale phase timer accepted                      | Caught                                                          |
| M18      | Disconnected player accepts controls            | Caught                                                          |
| M19      | Outer stale-input guard removed                 | Survived: independently rejected by `apply`'s judged-time guard |
| M20      | Views expose internal projectile/spawn counters | Caught                                                          |

M19's independent guard explains the unchanged observable behavior; it is not claimed as a kill.
The measured 19/20 meets the required threshold. The three-body collision-chain regression is
included in the 36 passing physics cases; it catches a head-on pair reverting into a follower.

## Seeded match measurements

Every batch contains 1000 seeds (1..1000), rotating easy/normal/sharp bots;
every fifth match disables weapon crates. All five rounds terminate, every original
player has a finite score and rank, and every match is below the 720000 ms budget.
Round measurements include maze identification before later fights; match measurements
also include score beats. Full per-strength aggregates are in `media/sim-N.json`.

| Seats | Median round (ms) | Median match (ms) | Longest match (ms) |
| ----- | ----------------- | ----------------- | ------------------ |
| 2     | 28370             | 214928.5          | 270130             |
| 3     | 27702             | 219878            | 265877             |
| 4     | 30232             | 240825.5          | 284026             |
| 5     | 30765             | 252773            | 296775             |
| 6     | 32296             | 269523.5          | 328523             |
| 7     | 33428             | 283871            | 328471             |
| 8     | 34760             | 300222.5          | 339824             |

After the full run, repeated per-target bot BFS was replaced by a shared read-only
route tree. The independent differential regression compares all 60 cells in 1000
seeded mazes: all 60000 paths match. Representative eight-seat decisions drop from
318446 graph visits to 60000 (5.31x fewer); all-target work drops from1597601 to60000
(26.63x fewer). Neighbor order, tie breaks, RNG consumption and decisions are unchanged.
Final routing/behavior/SDK command:
`pnpm.cmd vitest run games/tank-trouble/__tests__/bot-route.test.ts games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=verbose`.
PASS: 76 tests, exit0,10.62s. CI will run the full suite on the optimized source.

The first full106-test run and76-test route check used the working directory games/ricochet-rumble before the owner-required migration. Final official-name command: `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads`, PASS: 43 tests, exit 0, 14.17 s. The final mutation rerun on games/tank-trouble passed54 baseline tests and19/20 behavioral kills; independent hash comparison found0 mismatches across6 restored files. Its preflight first rejected an M20 formatting anchor before planting anything; the anchor was corrected and all20 unique sites revalidated. No failed preflight is counted as a kill.

## KEEP GOING R1 verification

Initial official-name head6668224 passed CI38197193579 (2026-10-12T02:52:10Z); the improvement loop began after that green run. `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/generate.test.ts --maxWorkers=1 --pool=threads` passed1 fixture test, followed by `pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads`:98 PASS, exit0,68.21 s. `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/simulation.test.ts --maxWorkers=1 --pool=threads -t 'at 8 seats'`:1 PASS,6 intentionally skipped,1000 matches, exit0,161.28 s. New eight-seat median round17721.5 ms, match137768 ms, longest177286 ms. Initial table above is the pre-loop baseline; remaining per-count media will refresh in the final full run. `node jobs/P22-ricochet-rumble/capture.mjs`:40 screens fit, zero failures, browserPID91536 closed. Default paused Fire contrast measured1.482:1, logged for repair in a later loop round. Type/format and fresh hashes follow each source/evidence milestone.

## KEEP GOING R2 verification

The first new departed-scene regression reached DONE because the supplied play fixture was from round five: 64 tests passed, one fixture assertion failed. Rebuilt that scene from game.init followed by real leave/skip/next-round/reconnect events. `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads` then passed all 65 tests, exit 0, 25.72 s. The render clock now uses the actual play snapshot's began+checked time, and the paused scene uses the actual pause reducer. `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads` passed 27 tests, exit 0, 2.27 s.

`PB_MEASURE_MOTION=1 PB_MOTION_LABEL=baseline-before-smoothing node jobs/P22-ricochet-rumble/capture.mjs` recorded zero intermediate poses in both normal and reduced modes. Its process-tree shutdown ran in finally, but the five-second verification startup timed out; a native exact-PID check confirmed PID 20348 absent, and a filtered profile check confirmed zero owned Chrome children. Capture tooling now gracefully closes CDP, retains the exact-PID fallback, allows 15 seconds for native verification, and fails if closure cannot be verified. The final `node jobs/P22-ricochet-rumble/capture.mjs` passed all 44 clock-aligned captures, exit 0; PID 81376 closed in finally. Previous motion source hashes describe the runtime input at that diagnostic, before subsequent HTML formatting/clock alignment. R1 head a7261ec also passed CI 38198645095.

## KEEP GOING R3 verification

R2 head 4f2ea25 passed CI 38200282396. `pnpm.cmd typecheck` passed.
`pnpm.cmd vitest run games/tank-trouble/__tests__/controls-model.test.ts games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --reporter=dot` passed 33 tests, exit 0, 2.92 s.
`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --reporter=dot` passed 27 tests, exit 0, 1.34 s.
`pnpm.cmd exec node jobs/P22-ricochet-rumble/input-harness/build.mjs` builds an offline inline copy of the actual Controller using installed Vite; no dependencies added.
`PB_INPUT_CHECKS=1 PB_INPUT_SCREENSHOT=1 node jobs/P22-ricochet-rumble/capture.mjs` passed 30 input cases and 44 screen fits, exit 0; owned PID 17892 closed in finally. OS temp cleanup was deferred after EPERM, with the process already confirmed closed.
The report's SHA256 matches the final harness. Root inspected the held-touch phone image: steering, Fire, maze, roster and help fit with no scrolling. Two contacts simultaneously drive, turn and fire; center neutralizes only steering. Cancellation, blur/pagehide, phase, pause and disconnection clear both sources; stale contacts cannot restart them. Mouse and all five Enter-key button paths also passed.

## KEEP GOING R4 verification

R3 head e1fd690 passed CI 38202329022. The first skip fixture used paused departures, but SDK resume handling ended that fight with reason last-standing before skip; 67 tests passed and the fixture assertion failed. The corrected fixture uses a valid pending shell hit and actual VIP skip, compared with the normal timer's identical award.
`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=dot` passed all 68 tests, exit 0, 14.16 s. `pnpm.cmd typecheck` passed. Four new skipped-winner frames bring capture coverage to 48 screens. The regression checks all four rendered-word reading floors and retains the zero-award skip behavior.
`node jobs/P22-ricochet-rumble/capture.mjs` passed 48 fits, exit 0, zero failures. Owned PID 110552 closed in finally; temp cleanup deferred after EPERM. Root inspected the long-name skipped-winner phone-only frame: gain, rank and countdown fit and agree.

## KEEP GOING R5 verification

The first seven new bot-shot cases plus existing routing/physics/lifecycle/SDK checks passed 83 tests, exit 0, 16.38 s. Review added a separate swept tank-to-muzzle wall regression before simulation.
`pnpm.cmd vitest run games/tank-trouble/__tests__/bot-shot.test.ts games/tank-trouble/__tests__/bot-route.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=dot` then passed 84 tests, exit 0, 36.04 s. `pnpm.cmd typecheck` passed.
`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/simulation.test.ts --maxWorkers=1 --pool=threads --reporter=dot -t 'at 8 seats'` passed 1000 matches, one test and six intentionally skipped count cases, exit 0, 170.90 s. New eight-seat median round 17644 ms, median match 137684 ms, longest 180653 ms. The final full run will refresh all counts. No client rendering changed in this round.

## KEEP GOING R6 verification

`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads --reporter=dot` passed 33 tests, exit 0, 1.10 s; `pnpm.cmd typecheck` passed. The eight-seat Burst fixture pre-equips the weapon and lifts the spawn shield, then actual reducer inputs settle the first 20 ms sample: three owned shells, one volley, reloadAt 720. It verifies ownership, held Fire availability and pause/offline priority.
`node jobs/P22-ricochet-rumble/capture.mjs` passed all 52 captures, exit 0, zero fit failures; PID 108380 closed in finally, temp cleanup deferred after EPERM. Root inspected the Burst phone-only image: volley count, waiting message and controls fit with the shell header/footer reserved.

## KEEP GOING R7 verification

`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads --reporter=dot` passed 33 tests, exit 0, 1.66 s. `node jobs/P22-ricochet-rumble/capture.mjs` passed 52 fits, exit 0; PID 21940 closed in finally, temp cleanup deferred after EPERM. Actual computed-style contrast in play-paused-phone-only is 12.674:1 for all five disabled pads; the previous disabled Fire baseline was 1.482:1.
Read-only calculations from design/tokens.css (opacity 1) for before→after Fire: night 1.482→12.674, daylight 1.402→14.419, arcade 1.535→16.158, cabin 1.396→11.803, contrast 2.439→15.523. These other-theme ratios are token-derived, not browser measurements. The disabled selector beats the Fire selector; inactive controls immediately omit data-held, so the held-Fire rule cannot override it.

## KEEP GOING R8 verification

`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads --reporter=dot` passed 33 tests, exit 0, 1.87 s. `pnpm.cmd typecheck` passed. `node jobs/P22-ricochet-rumble/capture.mjs` passed 52 fits, exit 0; PID 62156 closed in finally, temp cleanup deferred after EPERM. Root inspected the TV maze/legend image; all three authored marks are shared, and weapon names remain body-sized alongside them.

## KEEP GOING R9 verification

`pnpm.cmd vitest run games/tank-trouble/__tests__/lifecycle-order.test.ts games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/sdk.test.ts games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads --reporter=dot` passed 112 tests, exit 0, 60.89 s. `pnpm.cmd typecheck` passed. Five new regressions pin actual pending-hit physics, expired-cap draws, scoring before presence, completion before pause, retained scores and future exclusions, and ongoing-pause two-departure deferral. Existing input state remains byte-identical. No client rendering changed.

## KEEP GOING R10 verification

`pnpm.cmd vitest run games/tank-trouble/__tests__/bot-shot.test.ts games/tank-trouble/__tests__/bot-route.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=dot` passed 87 tests, exit 0, 140.10 s. `pnpm.cmd typecheck` passed. Three new Burst regressions use actual physics for unsafe side returns, blocked side muzzles and an outer-only rival contact; independent source review found no concrete defect. Full simulations will refresh after all loop changes. No rendering changed.

## KEEP GOING R11 verification

`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/controls-model.test.ts --maxWorkers=1 --pool=threads --reporter=dot` passed 39 tests, exit 0, 4.28 s. `pnpm.cmd typecheck` and `pnpm.cmd exec node jobs/P22-ricochet-rumble/input-harness/build.mjs` passed.
`PB_MEASURE_MOTION=1 PB_MOTION_LABEL=after-smoothing PB_FEEDBACK_CHECKS=baseline node jobs/P22-ricochet-rumble/capture.mjs` passed 52 fits, zero failures, exit 0; PID 82976 closed in finally. Normal translation records ten intermediate tank and matching label positions, versus zero before smoothing. Both modes reach the exact endpoint; reduced motion has zero intermediate positions and an immediate endpoint. This probe measures translation, not a human rotation assessment.
The feedback diagnostic intentionally does not assert success: 5/8 expected cases pass before the fix. Actual ordinary timer transitions from PLAY checked 1080 to SCORE checked 1100 skip the terminal TV thud and own phone buzz. Paused permanent departure incorrectly requests one 90 ms buzz. The harness records SDK sound/vibration requests, not rendered audio or physical vibration. Archived harness hashes preserve the old input report and this baseline. Other cases confirm no later replay. Fix and rerun before completion.

## KEEP GOING R12 verification

`pnpm.cmd typecheck` and `pnpm.cmd exec node jobs/P22-ricochet-rumble/input-harness/build.mjs` passed. `PB_FEEDBACK_CHECKS=fixed PB_INPUT_CHECKS=1 PB_INPUT_SCREENSHOT=1 node jobs/P22-ricochet-rumble/capture.mjs` passed 8/8 feedback cases, 30/30 actual touch/keyboard cases and 52 fits, exit 0; PID 67432 closed in finally. Fixed feedback now requests exactly one thud and one own-loss buzz at the actual 1100 ms terminal hit, one thud with no survivor buzz, and no paused-departure or subsequent replay cues. Reports reference matching archived/compiled harness bytes. Media was 6,928,695 bytes before formatting; refreshed SHA manifest follows formatting. No physical sound/vibration observation is claimed.

## KEEP GOING R13 verification

`PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=dot` passed 62 tests, exit 0, 26.29 s. `pnpm.cmd typecheck` and the actual input-harness build passed. New SSR checks compare timer text before a real 60 s pause, during its held clock, and immediately after resume; all five TV/player/spectator/remote surfaces agree. Final SCORE is included. Only powerupsEnabled is exposed; private settings remain absent.
`PB_MEASURE_MOTION=1 PB_MOTION_LABEL=display-clarity PB_FEEDBACK_CHECKS=fixed PB_INPUT_CHECKS=1 PB_INPUT_SCREENSHOT=1 node jobs/P22-ricochet-rumble/capture.mjs` passed 64 fits, 30 input cases and eight feedback cases, exit 0; PID 55800 closed in finally. Root inspected paused READY phone-only, paused SCORE TV and no-powerup TV images. The raw generated HTML contains a trailing space in the unchanged SDK theme comment; formatting removes it before the final diff/format check. Media was 7,499,707 bytes before formatting. Previous head 6f22b62 passed CI 38206917327, including full game tests (4m41s job).

Post-R13 `pnpm.cmd format` and `git diff --check` passed before push b6d1b99. A full evidence run of `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble --maxWorkers=1 --pool=threads --reporter=dot` was deliberately cancelled with Ctrl-C after an independent audit found a new firing-preview candidate. It exited 1, no full coverage is claimed; exact r1 Vitest/tinypool process query found no worker remaining. Its sole partial sim-2 artifact is restored pending the complete rerun after R14.

## KEEP GOING R14 verification

Tests were added before source: `pnpm.cmd vitest run games/tank-trouble/__tests__/bot-pulse.test.ts --maxWorkers=1 --pool=threads --reporter=verbose` intentionally failed 15 expectations (693 ms). The legacy 1120 ms owner death and the held-command 1980 ms death assertions passed before the new bot-command expectations failed; the output showed the original turn=-1/fire=true mismatch. Some failures reflect the newly introduced pulse shape, not additional gameplay defects.
After source: `pnpm.cmd vitest run games/tank-trouble/__tests__/bot-pulse.test.ts games/tank-trouble/__tests__/bot-shot.test.ts games/tank-trouble/__tests__/physics.test.ts games/tank-trouble/__tests__/game.test.ts games/tank-trouble/__tests__/lifecycle-order.test.ts games/tank-trouble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=dot` passed 105 tests, exit 0, 9.10 s. `pnpm.cmd typecheck` and `node jobs/P22-ricochet-rumble/mutate.mjs --check` passed (20 unique sites, no bugs planted).
Cases preserve useful Shell/Burst/Beam/Seeker volleys, cover six readiness deferrals and exact-next-sample eligibility, retain human reload queueing, and judge both self-hit failures plus an actual successful dodge. The input pulse has no privilege or new dependency. Pause/drop/death neutralize its latch. Post-R13 head b6d1b99 passed CI 38207456916 (3m53s job). Full simulation/property/mutation/render evidence follows on the new source.

## Final source verification

On R14 source 2a31ade, `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/tank-trouble --maxWorkers=1 --pool=threads --reporter=dot` passed all 164 tests in 12 files, exit 0, 521.44 s. This includes 1003 property seeds, generated phase fixtures and 7000 terminating matches: 1000 at each supported count 2..8, cycling all three bot strengths. Every match is below the 720000 ms budget. These measurements supersede the initial table for the finished source:

| Seats | Median round (ms) | Median match (ms) | Longest match (ms) |
| ----- | ----------------- | ----------------- | ------------------ |
| 2     | 19646             | 149694            | 201693             |
| 3     | 19879             | 149193            | 196159             |
| 4     | 20312             | 151940            | 193357             |
| 5     | 20400             | 152071.5          | 201455             |
| 6     | 20578             | 153403            | 199989             |
| 7     | 20811             | 153954            | 191721             |
| 8     | 20844             | 155268            | 202453             |

`node jobs/P22-ricochet-rumble/mutate.mjs` passed its 54-test baseline and killed 19 of 20 planted bugs with assertion failures, with zero invalid mutations. M19 survives because an inner stale-event guard makes that outer guard redundant. An independent PowerShell Get-FileHash comparison against media/mutation-results.json found zero mismatches across all six restored source files; `git diff --exit-code -- games/tank-trouble/server` passed. After reloading the fresh generated fixtures, `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/tank-trouble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads --reporter=dot` passed all 42 SSR checks, exit 0, 2.05 s.

The rebuilt offline Controller harness is 398968 bytes, SHA256 prefix 32bc2529336a. First final capture: 64 fits, eight feedback cases and motion passed, but mouse drag/release failed (28/30 input cases). That report and exact harness are preserved as media/input-results-final-first-attempt.json and media/input-harness-32bc2529336a.html. Browser PID8360 closed in finally. A diagnostic rerun with `PB_INPUT_POINTER_AUDIT=1 PB_MEASURE_MOTION=1 PB_MOTION_LABEL=final-pointer-audit PB_FEEDBACK_CHECKS=fixed PB_INPUT_CHECKS=1 PB_INPUT_SCREENSHOT=1 node jobs/P22-ricochet-rumble/capture.mjs` passed 30/30 cases, but reported no native mouse capture under touchscreen emulation. PID61656 closed in finally. This quick rerun alone does not resolve the earlier failure; device-mode separation and a held/outside-pad capture check remain pending.

## KEEP GOING R16 verification

Touch cases now run first with mobile touchscreen emulation; mouse and keyboard then use a desktop device at the same390x844 layout. Six extra assertions check the actual mouse pointer ID/type, native capture, the original connected pad node, a700ms hold across fresh heartbeats, and movement/release outside the pad. The first strict run failed32/36, archived in media/input-results-desktop-first-attempt.json; PID59064 closed in finally. Capture and node identity survived the long hold, then capture was lost exactly on our held mouseMoved packet with button:none/buttons:1. Device-mode separation alone was insufficient.

Official [Puppeteer CdpMouse.move source](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/cdp/Input.ts#L335) sends the button matching the pressed mask. Both held move packets were corrected to button:left/buttons:1; hover remains none/0 and release left/0. All36 assertions remain strict, without skips or retries. No production control source changed.

Final exact command: `$env:PB_INPUT_POINTER_AUDIT='1'; $env:PB_MEASURE_MOTION='1'; $env:PB_MOTION_LABEL='final-consistent-mouse-drag'; $env:PB_FEEDBACK_CHECKS='fixed'; $env:PB_INPUT_CHECKS='1'; $env:PB_INPUT_SCREENSHOT='1'; node jobs/P22-ricochet-rumble/capture.mjs`. PASS:36/36 input cases,8/8 SDK feedback cases and64 screen fits, exit0. Native capture and stable pad identity pass after the held interval and outside movement; release relinquishes capture and sends neutral. PID107688 closed in finally. Temp cleanup deferred after EPERM only after process closure was verified. Raw media9369947 bytes, below10MB. Normal motion retains ten intermediate tank/label positions; reduced motion has none and reaches the endpoint immediately. Final motion artifact hashes match the current formatted HTML. Three older motion runs have recorded historical observations but their exact pre-format HTML was not archived; those old inputs are not claimed currently reproducible.

Root inspected fresh eight-seat long-name phone-only PLAY and tied long-name TV DONE frames: controls, stage, standings and reserved shell space fit. Independent read-only review matched all153 checkpoint media hashes and R14 source, then found no further mandatory gameplay defect. It repaired handoff issues: README links now resolve in the exact PR body, and the first archived input report is plain UTF-8 JSON without a BOM. Post-evidence headc84b0dd passed CI38211244255.

`pnpm.cmd typecheck`, `pnpm.cmd format` and `git diff --check` passed on the refreshed evidence. After final JSON formatting, `node jobs/P22-ricochet-rumble/hash-media.mjs` recorded154 files/9362411 bytes. Independent Get-FileHash comparison found zero media mismatches and zero mismatches across the six mutation source hashes. `git diff --exit-code -- games/tank-trouble/server games/tank-trouble/client` passed. README is31 lines. A server-only scan for Math.random/Date.now/timers/fetch/HTTP URLs found zero matches.
