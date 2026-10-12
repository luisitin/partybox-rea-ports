# Verification

Install once: `corepack enable`; `pnpm.cmd install`, completed. Windows script policy requires the cmd shim. No dependency was added by P07.

## Tests and contracts

Latest completed full check: `pnpm vitest run games/paper-territory --maxWorkers=1`, [CI 38182241720](https://github.com/luisitin/partybox-rea-ports/actions/runs/38182241720), head `e87dc662df09c7cdefaab89326877cae7b044a7f`: **133/133 tests in14files**,64.55s; typecheck and format also passed. This includes real SDK contracts,1,003property traces and3,000simulations, including the shorter bot fallback. Later R8–R11 home/phone/result/departure changes need fresh CI. `tools/record-scoped-ci.mjs <run-id>` retains exact metadata, metrics and per-game-file tested/local SHA256 comparisons in latest-scoped-ci.json; historical final-ci files remain labelled with their original head.

Resumed focused commands: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-territory/__tests__/artifacts.test.tsx games/paper-territory/client --maxWorkers=1`:57/57passed in3.03s. `pnpm.cmd vitest run games/paper-territory/__tests__/presence.test.ts games/paper-territory/__tests__/contract.test.ts games/paper-territory/client/feedback.test.tsx --maxWorkers=1`:51/51passed in9.43s after permanent departure fix. No other game's tests or browser suite ran.

Historical local checks before KEEP GOING:

- `PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/paper-territory --maxWorkers=1`: 76/77 tests passed in 174.38 s. One real SDK fast-scheduler starvation failure: bots repeated an already queued heading just before a tick. Fixed by returning null when the heading is already queued.
- Post-fix contract/world/lifecycle/presence/bot run: **56/56 passed**, 7.75 s, including all 20 real SDK contracts (fast/random/idle/skipper, views, purity, reconnect, VIP). Exact commands and aggregate evidence: tools/verification-results.json.
- `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-territory/client games/paper-territory/__tests__/artifacts.test.tsx --maxWorkers=1`: **24/24 passed**, 1.87 s after ownership textures and enlarged markers. Fixtures and static HTML come from a real seeded eight-bot match.
- Final `pnpm.cmd typecheck`: passed, exit 0. `pnpm.cmd format`: all matched files use Prettier code style. Earlier checks prompted corrections to client tuple/optional-class typing. Generated contact sheets were formatted last.

## Simulation and properties

The current authoritative CI executed 1,000 seeds at each player count, with 600 ms bot decisions and 200 ms physics. Each batch cycles easy/normal/sharp (334/333/333 games). All **3,000 terminated** within the manifest limit of 360,000 ms.

| Players | Games | Median play | Maximum whole game | Wall time |
| ------- | ----- | ----------- | ------------------ | --------- |
| 2       | 1,000 | 120,000 ms  | 131,000 ms         | 5.68 s    |
| 4       | 1,000 | 120,000 ms  | 131,000 ms         | 11.03 s   |
| 8       | 1,000 | 120,000 ms  | 131,000 ms         | 21.51 s   |

tools/simulation-results.json and tools/final-keep-going-simulation-results.json record current per-strength area, captures, deaths and growth beyond home. These are same-strength matches and do not establish mixed-match skill ordering. Compared with the retained pre-loop 1,000-game eight-seat batch, sharp median area rose 9→48, median captures 16→37 and mean deaths fell 9.966→5.954 (40.26%). The original local timings (6.55/33.19/60.70 s) and experiments remain historical evidence. An obsolete early 200 ms decision batch was stopped and is not counted: tools/obsolete-batch.md.

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

Latest `node jobs/P07-paper-territory/tools/capture.mjs`: **32screens** with one isolated cached Chromium, closed in finally. TV1920×1080; phones390×844 with80pxreserved at both ends for the shell. Every phase covers local/phone-only/remote/spectators; play includes paused/eliminated phones and adjacent heads with maximum-area/long-name rows; final screens stress long-name players/spectators. It waits for the correct complete document, fonts and two painted frames before measurements/capture.

Fit report: zero horizontal/vertical overflow, outside elements or internal scrolling. Smallest active touch: **58.65625 px**. Manually inspected three contact sheets: shared map is focal, eight original monochrome ownership textures, persistent homes, readable numbered direction markers, eight-seat standings. TV body 36 px, timer 96 px from tokens. Reduced-motion disables control transitions.

Resumed captures confirmed zero overflow/outside/internal-scroll failures,58.65625pxminimum active touch,358×256pxfinal stage maps and15.108pxhead glyphs. Manually inspected final long-name screens, adjacent-head stress screens and TV/local/stage contact sheets. Media after format:4,990,382bytes across71files, below10MB; recompute/verify SHA256SUMS.txt after any formatting. Capture accepts PB_CHROME for an existing executable; installs no browser/dependency.

## CI and iteration

.github/workflows/P07.yml uses read-only permissions, Ubuntu, 30-minute timeout, actions/* only and P07 paths. It installs, typechecks, formats and runs only this game. Draft PR leaves draft only after green CI. CI result and post-green audits will be recorded here/LOOP.md.

Initial full CI passed: [run 38177872218](https://github.com/luisitin/partybox-rea-ports/actions/runs/38177872218), 1m30s. PR #4 left draft after this result. R1 targeted command: `pnpm.cmd vitest run games/paper-territory/client/DirectionPad.test.tsx games/paper-territory/client/controls.test.ts games/paper-territory/__tests__/views.test.ts games/paper-territory/__tests__/contract.test.ts --maxWorkers=1`; 3 existing files, 27/27 assertions passed in 4.57 s. The views glob has no separate file; projections are checked by SDK contract and the real-game controller regression.

R1–R6 source changes and focused results are recorded in LOOP.md. The authoritative current full result above replaces the duplicate local attempt, which was stopped to preserve desktop CPU. Native PowerShell processes stalled after output; the equivalent installed CLI fallback was `env -u PB_SIM_GAMES PB_RECORD_VERIFY=1 node node_modules/vitest/vitest.mjs run games/paper-territory --maxWorkers=1`. Exact attempts are in tools/final-keep-going-command.json; partial local logs are explicitly non-final. The first fresh capture timed out at Page.captureScreenshot and is not counted. A subsequent 28-screen capture produced zero fit failures and 58.671875 px minimum touch; it was manually reviewed, and its owned browser/profile were closed/removed in cleanup. The Windows CDP handle retained an idle Node process after cleanup, so the tool now exits explicitly only after successful finally completion. Final adjacent-head stress captures and the next client CI remain pending.
