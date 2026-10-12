# Historical r5-local verification

The fresh current-code full run passed **105/105 tests and 7,000 complete matches**, exit 0. Typecheck, formatting, 20/20 mutations, property tests and nine measured screens also pass. PR CI and the post-green KEEP GOING loop remain pending. Historical failed-run evidence is retained separately.

## Setup and static checks

| Check                   | Exact command                                                                       | Confirmed result                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Corepack                | `corepack enable`                                                                   | Passed.                                                                                       |
| Dependencies            | `pnpm.cmd install`                                                                  | Passed with pnpm 12.4.2 and Node 24.19.0; no new dependencies added.                          |
| Fixtures                | `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/generate.mjs` | Passed; seeded fixtures generated with seed 17, including the last-score → done continuation. |
| Final current typecheck | `pnpm.cmd typecheck`                                                                | Passed after the server, client and tests were present.                                       |
| Final formatting        | `pnpm.cmd format`                                                                   | Passed after the pause fix and interactive preview.                                           |

## Game, SDK contract and property tests

Current-tree command: set PowerShell `$env:PB_SIM_RUNS='1'`, then run `pnpm.cmd vitest run games/blob-arena --maxWorkers=1 --reporter=json --outputFile=jobs/P05-blob-arena/current-tests.json`. Result: **105/105 tests passed**, seven files, exit 0. This includes the real SDK contract suite restricted to Blob Arena, the new pause regression, mechanics/lifecycle/view tests, Arena regressions and property tests. [current-tests.json](current-tests.json) retains the result. The short setting is not the required full simulation.

The property tests cover fixed world seeds **1, 2 and 3 at every count from 2 through 8**, plus **1,000 generated world seeds** with mixed controls. Fast-check's generator seed is `20261011`, making failures reproducible. Assertions check deterministic replay, source immutability, finite positive mass, bounded positions, unique cell/pellet IDs, the four-cell cap, 96 pellets, JSON state/view shape, the 256 KB state limit and absence of RNG/control data in controller views.

Fresh full command, with `PB_SIM_RUNS` unset: `pnpm.cmd vitest run games/blob-arena --maxWorkers=1 --reporter=verbose --reporter=json --outputFile=jobs/P05-blob-arena/full-tests.json --disableConsoleIntercept`. **105/105 passed in seven files, exit 0**, 1,645.83 seconds on the loaded desktop. [full-tests.json](full-tests.json) retains every result. Only this game's tests ran, using one worker, with game code unchanged throughout. Windows emitted nonfatal worker-termination warnings; all tests and the final process succeeded. The first full process started before the pause handler was patched; [full-first-cache.json](full-first-cache.json) preserves its passed simulation file and failed lifecycle file. Its overall result was 104 passed / one failed, so it is historical evidence rather than a green complete check.

## Full seeded simulation

The current game test command runs **1,000 complete three-round bot games at each count 2, 3, 4, 5, 6, 7 and 8**: 7,000 matches total. Each count cycles 334 easy, 333 normal and 333 sharp bot games. Bot decisions occur every 1,000 ms; the actual reducer handles its 200 ms engine wake timers and 100 ms physics grid.

The required bound is `manifest.estimatedMinutes × 2 = 600,000 ms`. **All 7,000 fresh matches passed**, with complete finite results and exactly three 90,000 ms rounds. Every count measured a 90,000 ms median round and 289,500 ms maximum match. [sim-report.json](sim-report.json) retains exact console records: **17,959,654 reducer events** total. The historical assertion-only report is separate in [sim-first-report.json](sim-first-report.json). The interim `PB_SIM_RUNS=1` run is not the required 1,000-game sweep.

| Players | Games | Easy / normal / sharp | Median round ms | Max match ms | Min / max score | Reducer events |
| ------- | ----- | --------------------- | --------------- | ------------ | --------------- | -------------- |
| 2       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 306 / 2,760     | 1,860,237      |
| 3       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 87 / 3,987      | 2,105,730      |
| 4       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 27 / 4,974      | 2,346,442      |
| 5       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 63 / 5,469      | 2,579,399      |
| 6       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 0 / 6,468       | 2,805,048      |
| 7       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 0 / 7,248       | 3,024,559      |
| 8       | 1,000 | 334 / 333 / 333       | 90,000          | 289,500      | 0 / 7,662       | 3,238,239      |

Equivalent standalone full-count command: `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/sim.ts`.

## Mutation check

Command: `node ./jobs/P05-blob-arena/mutations.mjs`.

Result: **20/20 bugs caught**, exceeding the required 19/20. The unmodified baseline passed. Each mutation was planted alone, then the harness ran `pnpm.cmd vitest run games/blob-arena/__tests__/mechanics.test.ts games/blob-arena/__tests__/game.test.ts --maxWorkers=1 --reporter=json --outputFile=jobs/P05-blob-arena/mutation-current.json`. Every catch was an assertion failure; no transform/import error or timeout counted. Original server bytes were restored after every mutation and verified at completion. Exact replacements, failing test names and assertion messages are retained in [mutations.json](mutations.json).

| ID  | Planted bug                                          | Result | Failed tests |
| --- | ---------------------------------------------------- | ------ | ------------ |
| M01 | Score rounds up instead of down                      | Caught | 2            |
| M02 | Score counts only the largest split part             | Caught | 1            |
| M03 | New round replaces previously banked points          | Caught | 2            |
| M04 | Match exits after two rounds                         | Caught | 1            |
| M05 | Timer waits beyond the horn before entering score    | Caught | 2            |
| M06 | Horn drops the final physics step                    | Caught | 2            |
| M07 | Predator needs only a 1.15 mass ratio                | Caught | 1            |
| M08 | Grazing edges swallow prey without deep overlap      | Caught | 1            |
| M09 | Spawn shields do not prevent eating                  | Caught | 1            |
| M10 | Splitting loses a third of the mass                  | Caught | 3            |
| M11 | Splitting has no cooldown                            | Caught | 1            |
| M12 | Splitting is allowed at starting mass                | Caught | 2            |
| M13 | The split cap allows eight cells                     | Caught | 2            |
| M14 | Siblings unlock merging after one second             | Caught | 1            |
| M15 | A swallowed seat respawns in half the specified time | Caught | 1            |
| M16 | Respawns lose their two-second shield                | Caught | 2            |
| M17 | A pellet awards double mass                          | Caught | 2            |
| M18 | An eaten pellet stays available at the same spot     | Caught | 1            |
| M19 | Resume fails to extend the round end clock           | Caught | 1            |
| M20 | TV view exposes the future random sequence           | Caught | 1            |

## Screens and fit

SSR command: `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/screens.mjs`.

Capture command: `node ./jobs/P05-blob-arena/capture.mjs`. The capture tool uses one owned headless Chromium process and closes it in `finally`.

Passed: **nine real-component HTML screens and nine PNGs**, covering `play`, `score` and `done` on TV at **1920 × 1080**, phone with a TV at **390 × 844**, and phone-only at **390 × 844**. [fit.json](fit.json) records **zero clipped measured elements and zero overlapping TV score labels** on all nine screens. Each document's scroll dimensions equal its viewport. The runner manually inspected all nine PNGs after the layout fixes; the eight-player roster, controls and standings fit.

The measurements inspect headings, buttons, list rows, timers and arenas, plus round/total score text ranges. They do not establish every possible name/content combination. Media totals **2,052,432 bytes**. PowerShell `Get-FileHash -Algorithm SHA256` verified all 18 entries in SHA256SUMS.txt with zero mismatches.

## CI and completion

CI check command: `gh pr checks <PR-number>`. PR creation and the job workflow's green status are **pending**; this file does not claim CI success. Local required checks and full simulation have passed. Green CI and KEEP GOING outcomes still need to be recorded before the job is complete.

## Additional measured checks

- `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/bot-benchmark.mjs`: 30 full matches at 2/4/8 players, 37,380 bot decision pairs; every input and RNG state matched the original distance-sort implementation. Cached distances reduced measured bot-call time from 693.84 ms to 327.19 ms (52.84%). [bot-benchmark.json](bot-benchmark.json) retains source and final-state/result hashes. This avoids repeating the same distance calculations inside the sort comparator without changing gameplay.
- Final `pnpm.cmd typecheck` and `pnpm.cmd format`: exit 0 after the pause steering fix and preview additions.
- Interactive preview + `capture.mjs`: eight real input sequences passed across both room modes: four drag/release checks, two two-finger steer/split/cancel sequences, and two keyboard steer/split/release sequences. Each split sequence sends exactly one split and ends at zero steering. A 22 px drag sends 0.17 with a TV and 0.21 in phone-only; 44 px sends 0.34 / 0.43. This is the pre-KEEP-GOING reach baseline in interactive-baseline.json.
- Before the pointer-down fix, a second-finger tap produced no split (only steering and STOP). Repeating the same real touch sequence after the fix produces exactly one split in each mode.
- Latest interactive capture closed its only headless browser in `finally` and exited 0.
