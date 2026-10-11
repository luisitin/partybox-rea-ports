# Verification

Install once: `corepack enable`; `pnpm.cmd install`, completed. Windows script policy requires the cmd shim. No dependency was added by P07.

## Tests and contracts

- `PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/paper-territory --maxWorkers=1`: 76/77 tests passed in 174.38 s. One real SDK fast-scheduler starvation failure: bots repeated an already queued heading just before a tick. Fixed by returning null when the heading is already queued.
- Post-fix contract/world/lifecycle/presence/bot run: **56/56 passed**, 7.75 s, including all 20 real SDK contracts (fast/random/idle/skipper, views, purity, reconnect, VIP). Exact commands and aggregate evidence: tools/verification-results.json.
- `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-territory/client games/paper-territory/__tests__/artifacts.test.tsx --maxWorkers=1`: **24/24 passed**, 1.87 s after ownership textures and enlarged markers. Fixtures and static HTML come from a real seeded eight-bot match.
- Final `pnpm.cmd typecheck`: passed, exit 0. `pnpm.cmd format`: all matched files use Prettier code style. Earlier checks prompted corrections to client tuple/optional-class typing. Generated contact sheets were formatted last.

## Simulation and properties

The full run executed 1,000 seeds at each player count, with 600 ms bot decisions and 200 ms physics. Each batch cycles easy/normal/sharp (334/333/333 games). All **3,000 terminated** within the manifest limit of 360,000 ms.

| Players | Games | Median play | Maximum whole game | Wall time |
| ------- | ----- | ----------- | ------------------ | --------- |
| 2       | 1,000 | 120,000 ms  | 131,000 ms         | 6.55 s    |
| 4       | 1,000 | 120,000 ms  | 131,000 ms         | 33.19 s   |
| 8       | 1,000 | 120,000 ms  | 131,000 ms         | 60.70 s   |

tools/simulation-results.json records per-strength area, captures, deaths and growth beyond home. These are same-strength matches and do not establish mixed-match skill ordering. The null-input fix preserves chosen headings and RNG decisions; targeted scheduler checks passed without repeating this CPU-heavy batch. An obsolete early 200 ms decision batch was stopped and is not counted: tools/obsolete-batch.md.

Property tests passed seeds 1, 2, 3 plus **1,000 generated seeds** (generator 0x5eed07), 40 mixed events per trace. Checks: JSON/finite/view bounds, spectator identity, source immutability, deterministic replay, complete results. All seeds: tools/property-results.json.

## Actual source mutations

`node jobs/P07-paper-territory/tools/mutate.mjs` ran 20 mutations serially against 35 fast baseline assertions. **20/20 caught by assertions**, exceeding 19/20. Before/after baselines passed 35/35; all source bytes restored and SHA-256 checked. Compiler/harness errors do not count. tools/mutation-results.json records exact edits, hashes and failing assertions.

| ID  | Planted bug                                  | Result |
| --- | -------------------------------------------- | ------ |
| M01 | Inflate area scores                          | Caught |
| M02 | Score timer never finishes                   | Caught |
| M03 | Play cap never exits                         | Caught |
| M04 | One-second instead of three-second return    | Caught |
| M05 | Allow reverse into preceding tile            | Caught |
| M06 | Wrap right edge into next row                | Caught |
| M07 | Rival land becomes flood barrier             | Caught |
| M08 | Trail no longer seals loop                   | Caught |
| M09 | Never award enclosed interior                | Caught |
| M10 | Forbid stealing enclosed rival land          | Caught |
| M11 | Capture protected rival homes                | Caught |
| M12 | Ignore own-trail crossing                    | Caught |
| M13 | Cut kills cutter instead of trail owner      | Caught |
| M14 | Ignore head swaps                            | Caught |
| M15 | Ignore converging heads                      | Caught |
| M16 | Move disconnected/inactive runners           | Caught |
| M17 | Retain expanded land after death             | Caught |
| M18 | Respawn permanent leaver                     | Caught |
| M19 | Last writer wins contested simultaneous land | Caught |
| M20 | Paused time consumes match cap               | Caught |

This game has no secret information. View assertions check public stage versus local-controller projections and unknown spectators. Raw local logs are gitignored; tracked JSON retains results and failure details.

## Screens and media

`node jobs/P07-paper-territory/tools/capture.mjs`: all **28 screens** with one isolated cached Chromium, closed in finally. TV 1920×1080; phones 390×844 with 80 px reserved at both ends for the shell. Every phase covers local/phone-only/remote/spectators; play also includes paused/eliminated phones.

Fit report: zero horizontal/vertical overflow, outside elements or internal scrolling. Smallest active touch: **58.65625 px**. Manually inspected three contact sheets: shared map is focal, eight original monochrome ownership textures, persistent homes, readable numbered direction markers, eight-seat standings. TV body 36 px, timer 96 px from tokens. Reduced-motion disables control transitions.

Media totals 4,160,887 bytes, below 10 MB; all 63 SHA256SUMS.txt entries verified after formatting. Capture accepts PB_CHROME for an existing executable; installs no browser/dependency.

## CI and iteration

.github/workflows/P07.yml uses read-only permissions, Ubuntu, 30-minute timeout, actions/* only and P07 paths. It installs, typechecks, formats and runs only this game. Draft PR leaves draft only after green CI. CI result and post-green audits will be recorded here/LOOP.md.
