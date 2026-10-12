# P22 verification

Run r1-local, Windows 11, Node 24, pnpm 12.4.2. PENDING: record every executed
command, its exit/result, seeded durations, mutation kills, layout checks and final CI.

No whole-suite run is authorized. Local game tests use a single thread worker.

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
