# P22 verification

Run r1-local, Windows 11, Node 24, pnpm 12.4.2. The full game suite passed; final mutation rerun, screen recapture and PR CI are pending.

No whole-suite run is authorized. Local game tests use a single thread worker.

| Check                            | Exact command                                                                                                                                                                                                                                                              | Result                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Install once                     | `corepack enable`; `pnpm.cmd install`                                                                                                                                                                                                                                      | Completed during P01 in this clone; pnpm 12.4.2 reused, no new dependencies                               |
| Types                            | `pnpm.cmd typecheck`                                                                                                                                                                                                                                                       | PASS on final initial implementation; repeat after behavior-preserving route optimization                 |
| Focused behavior/fixtures        | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/ricochet-rumble/__tests__/game.test.ts games/ricochet-rumble/__tests__/physics.test.ts games/ricochet-rumble/__tests__/generate.test.ts --maxWorkers=1 --pool=threads`                                              | Initial 53 tests PASS; final-winner regression subsequently added                                         |
| Final lifecycle/SDK/SSR/fixtures | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/ricochet-rumble/__tests__/game.test.ts games/ricochet-rumble/__tests__/sdk.test.ts games/ricochet-rumble/__tests__/generate.test.ts games/ricochet-rumble/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads` | PASS: 62 assertions, exit 0, 14.62 s                                                                      |
| Required game run                | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/ricochet-rumble --maxWorkers=1 --pool=threads --reporter=verbose`                                                                                                                                                   | PASS: 106 tests, exit 0, 1547.43 s; 1003 property seeds and 7000 complete matches at every count 2..8     |
| Formatting                       | `pnpm.cmd exec prettier --write games/ricochet-rumble jobs/P22-ricochet-rumble .github/workflows/P22.yml`; `pnpm.cmd format`                                                                                                                                               | Initial check caught fixtures rewritten by the opt-in generator; final write/check follows all generation |
| Static screens                   | opt-in `screens.test.tsx` command above; `node jobs/P22-ricochet-rumble/capture.mjs`                                                                                                                                                                                       | 40 frames passed fit checks; recapture pending after final fixture regeneration to synchronize PNG/HTML   |
| Media hashes                     | `node jobs/P22-ricochet-rumble/hash-media.mjs`                                                                                                                                                                                                                             | 90 media files; refresh hashes after recapture and final mutations                                        |
| CI                               | `.github/workflows/P22.yml`: install, types, format, this game's tests, Ubuntu, read-only, 30 min                                                                                                                                                                          | Pending PR                                                                                                |

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

Captures used one owned headless browser at a time, closed in `finally`. Final PID 73524 was
verified closed. Windows denied cleanup of its already-closed temporary directory; no other
process or profile was touched. There was no whole-suite browser run.

## Mutation evidence

`node jobs/P22-ricochet-rumble/mutate.mjs --check` passed: all twenty semantic anchors are
unique after formatting normalization; no source changed and no test ran in this check mode.

`node jobs/P22-ricochet-rumble/mutate.mjs` exited **0**. The unmodified focused baseline passed
**53 tests** (36 physics/scoring, 17 lifecycle/view). Each mutation then ran only its relevant
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
`pnpm.cmd vitest run games/ricochet-rumble/__tests__/bot-route.test.ts games/ricochet-rumble/__tests__/game.test.ts games/ricochet-rumble/__tests__/physics.test.ts games/ricochet-rumble/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads --reporter=verbose`.
PASS: 76 tests, exit0,10.62s. CI will run the full suite on the optimized source.
