# P06 verification

All commands run in the r6 clone. On Windows `pnpm.cmd` avoids the disabled PowerShell shim. Only this game's tests are run; one worker is used. Screen capture starts one isolated Chromium browser and closes it in finally. No full-suite browser run.

| Check                | Exact command                                                                                                                            | Result                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install once         | `corepack enable`; `pnpm.cmd install`                                                                                                    | Pass, frozen workshop dependencies reused                                                                                                                                                   |
| Typecheck            | `pnpm.cmd typecheck`                                                                                                                     | Pass after resolving a Windows case-insensitive helper/component filename collision                                                                                                         |
| Semantic rules       | `pnpm.cmd vitest run games/slither-io/server/rules.test.ts --maxWorkers=1`                                                               | 39/39 pass                                                                                                                                                                                  |
| Property seeds       | `pnpm.cmd vitest run games/slither-io/__tests__/properties.test.ts games/slither-io/__tests__/artifacts.test.tsx --maxWorkers=1`         | Pass: 3,000 generated seeds across seeds 1, 2, 3; mixed steering, clocks, disconnect/rejoin, pause/resume and skip; immutable sources/events and byte-identical replay; 288.60 s            |
| Fixtures and SSR     | `$env:SNAKE_WRITE_ARTIFACTS='1'; pnpm.cmd vitest run games/slither-io/__tests__/artifacts.test.tsx --maxWorkers=1`                       | Pass; play, score, final score and done generated; TV, phone, phone-only and spectator HTML                                                                                                 |
| Screen fit           | `node jobs/P06-snake-royale/capture.mjs`                                                                                                 | Pass: 16 screens, exact viewport/document dimensions and zero offscreen text at 1920×1080 and 390×844; PNGs reviewed                                                                        |
| Actual SDK contract  | `pnpm.cmd vitest run games/slither-io/__tests__/contract.test.ts --maxWorkers=1`                                                         | Pass: actual SDK wrapper, all 20 checks, including settings 1/3, min/mid/max players, fixture continuity and presence modes                                                                 |
| Seeded simulation    | `$env:SNAKE_WRITE_REPORTS='1'; $env:SNAKE_SIM_ALL_COUNTS='1'; pnpm.cmd vitest run games/slither-io/__tests__/sim.test.ts --maxWorkers=1` | All 7,000 matches completed and passed game-time, score and size assertions; count 8 exceeded the test's wall-clock guard after completing its 1,000 matches. Separate green rerun pending. |
| Mutation experiment  | `node jobs/P06-snake-royale/mutate.mjs`                                                                                                  | Pass: 20/20 actual semantic faults caught, exact source restored in finally; diagnostics in media/mutations.json                                                                            |
| Formatting           | `pnpm.cmd format`                                                                                                                        | Pass; final refresh after media reports pending                                                                                                                                             |
| Complete game checks | `$env:SNAKE_SIM_RUNS='1'; pnpm.cmd vitest run games/slither-io --maxWorkers=1`                                                           | Pass: 7 files, 118 tests in 156.03 s; only simulation repeats reduced, exhaustive 1,000-seed runs recorded separately                                                                       |
| CI                   | P06 workflow on pull request                                                                                                             | Pending draft PR                                                                                                                                                                            |

## Discovered and fixed

- Boost at size 8.1 emitted 0.3 food while spending 0.1; food now equals actual spend.
- VIP end during pause advanced the frozen world; it now banks at pause time.
- Rounded bot angles could exceed ±π; they are clamped to the schema.
- Windows chose `standings.ts` for a `Standings.tsx` import; the helper has a distinct filename.
- First static capture omitted SDK Stage CSS. It now includes the actual frame style.
- Eight two-line TV rows overfilled the stage. TV roster text is 32 px with explicit line height; all recaptures fit.
- Nearest-food sorting was unnecessary work on every bot decision. A strict-minimum single pass preserves stable ties. Regeneration left all four fixture SHA-256 hashes identical; rules, artifacts and actual SDK suite passed 60 checks in 35.21 s.

The exhaustive simulation was paused after counts 2–4 to remove that equivalent lookup overhead, then resumed for counts 5–8 with `$env:SNAKE_WRITE_REPORTS='1'; $env:SNAKE_SIM_COUNTS='5,6,7,8'; pnpm.cmd vitest run games/slither-io/__tests__/sim.test.ts --maxWorkers=1`. Each completed count has its own 1,000-seed report. No other game's tests were run.

| Players | Matches completed | Median round ms | Maximum state bytes |
| ------- | ----------------- | --------------- | ------------------- |
| 2       | 1000              | 90000           | 9029                |
| 3       | 1000              | 90000           | 11580               |
| 4       | 1000              | 90000           | 13079               |
| 5       | 1000              | 90000           | 13841               |
| 6       | 1000              | 90000           | 14660               |
| 7       | 1000              | 90000           | 15632               |
| 8       | 1000              | 90000           | 16374               |

Each count includes 334 easy, 333 normal and 333 sharp matches. Every three-round match takes 291,000 simulated milliseconds, below the 600,000 ms bound. The eight-player test completed all assertions in 1,253.876 wall-clock seconds, then Vitest reported its 1,200-second wall timeout; the entire 5–8 command exited 1. This is recorded as a failed runner check, not a green test. A local-only `SNAKE_SIM_TIMEOUT_MS` override allows a longer wall guard without changing any game-time/event assertions or the CI default. Rerun command: `$env:SNAKE_WRITE_REPORTS='1'; $env:SNAKE_SIM_COUNTS='8'; $env:SNAKE_SIM_TIMEOUT_MS='2400000'; pnpm.cmd vitest run games/slither-io/__tests__/sim.test.ts --maxWorkers=1`.

The subsequent allocation-only food-loop change passed 10,006 collection and 2,500 complete-world differential checks (`pnpm.cmd exec tsx reports/r6-food-loop/check.ts`). An alternating five-sample microbenchmark of 1,000 calls per case (`pnpm.cmd exec tsx reports/r6-food-loop/bench.ts`) measured 1.054× untouched-70, 1.016× untouched-240, 1.019× single-eater, 1.064× mixed and 1.170× tied paths; raw samples are in media/food-benchmark.json. These are local microbenchmarks, not whole-game speedups. Fixture regeneration plus Prettier left all four fixture hashes identical, and the real rules/artifacts/SDK run passed 60/60 checks in 23.67 s (exit 0; Windows fork-termination warnings).

Reproducible copies are now shipped in experiments/food-loop/. Commands: `pnpm.cmd exec tsx jobs/P06-snake-royale/experiments/food-loop/check.ts` and `pnpm.cmd exec tsx jobs/P06-snake-royale/experiments/food-loop/bench.ts`. The shipped check compares the actual optimized world against a wrapper that restores only the original collection block; its exact source marker guards against silently comparing changed rules. The wrapper is generated only under ignored reports/. These adapted copies have been formatted but have not yet been run.

## Mutation results

Each fault was planted separately and caught by a failing semantic assertion. All 20 records in `media/mutations.json` have `killed: true` and exit code 1. The exact original source was restored after each run.

| #   | Planted fault                                        | Status |
| --- | ---------------------------------------------------- | ------ |
| 1   | Round mass scores round up instead of down           | Killed |
| 2   | Round points are added twice                         | Killed |
| 3   | The terminal phase produces no results               | Killed |
| 4   | The round-end time comparison is reversed            | Killed |
| 5   | Timers are accepted before their deadline            | Killed |
| 6   | Disconnected players can send steering inputs        | Killed |
| 7   | Inputs older than the judged arena time are accepted | Killed |
| 8   | Player connection status is never updated            | Killed |
| 9   | Boost stays held after a disconnect                  | Killed |
| 10  | Phone-only players are not sent the arena            | Killed |
| 11  | Boosting spends no mass                              | Killed |
| 12  | Snakes can boost at minimum mass                     | Killed |
| 13  | Boosting uses normal movement speed                  | Killed |
| 14  | Steering turns in the opposite direction             | Killed |
| 15  | The right wall no longer kills snakes                | Killed |
| 16  | A snake collides with its own body                   | Killed |
| 17  | One head survives a simultaneous head-on collision   | Killed |
| 18  | Eating food adds no mass                             | Killed |
| 19  | Food growth ignores the maximum mass cap             | Killed |
| 20  | Tied eaters each receive the food's full value       | Killed |

All shipped media must remain below 10 MB, and every media file is listed in `SHA256SUMS.txt`. Final media counts, simulated median round lengths and the CI URL will be recorded before readiness.
