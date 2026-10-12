# Verification

Install once: `corepack enable`; `pnpm.cmd install`, completed. Windows script policy requires the cmd shim. No dependency was added by P07.

## Tests and contracts

Historical completed full check before R16/rename: `pnpm vitest run games/paper-territory --maxWorkers=1`, [CI 38193812748](https://github.com/luisitin/partybox-rea-ports/actions/runs/38193812748), head `4cfccbc75e04e5c00247cc73f091c0c9a6690536`: **147/147 tests in 14 files**, 122.41 s; typecheck and format also passed. This includes real SDK contracts, 1,003 property traces, 7,000 simulations at every count 2–8 and R12–R14 visual feedback changes. Game-file SHA256 comparisons matched that tested head when recorded. Historical files retain their original paths and provenance.

Latest full check after R16/official-name rename: `pnpm vitest run games/paper-io --maxWorkers=1`, [CI 38195244834](https://github.com/luisitin/partybox-rea-ports/actions/runs/38195244834), head `7b9e1b6c7e932720165c33cd037218f9af955807`: **147/147 in 14 files**, 78.19 s; typecheck and format passed. All 7,000 matches at counts 2–8 terminate at a median 120,000 ms play / maximum 131,000 ms whole game, below the 360,000 ms budget. All 1,003 property traces pass. `tools/record-scoped-ci.mjs 38195244834` preserves exact metrics and every game-file SHA256 comparison in latest-scoped-ci.json; all match the tested head.

Focused R16/rename command: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-io/client games/paper-io/__tests__/artifacts.test.tsx games/paper-io/__tests__/presence.test.ts games/paper-io/__tests__/contract.test.ts --maxWorkers=1`: **89/89 in 9 files**, 8.25 s. Real leave/kick phones show truthful permanent status, public map/standings and no controls in both room modes. Local `pnpm.cmd typecheck` and `pnpm.cmd format` passed.

Resumed focused commands: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-territory/client games/paper-territory/__tests__/artifacts.test.tsx --maxWorkers=1`: 60/60 passed in 10.25 s after displaced labels, visible trail gaps and public crash causes. `pnpm.cmd vitest run games/paper-territory/__tests__/presence.test.ts games/paper-territory/__tests__/contract.test.ts games/paper-territory/client/feedback.test.tsx --maxWorkers=1`: 51/51 passed in 9.43 s after permanent departure fix. Revised `pnpm.cmd vitest run games/paper-territory/__tests__/property.test.ts --maxWorkers=1`: all 1,003 traces passed (4 assertions, 35.14 s). No other game's tests or browser suite ran.

Historical local checks before KEEP GOING:

- `PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/paper-territory --maxWorkers=1`: 76/77 tests passed in 174.38 s. One real SDK fast-scheduler starvation failure: bots repeated an already queued heading just before a tick. Fixed by returning null when the heading is already queued.
- Post-fix contract/world/lifecycle/presence/bot run: **56/56 passed**, 7.75 s, including all 20 real SDK contracts (fast/random/idle/skipper, views, purity, reconnect, VIP). Exact commands and aggregate evidence: tools/verification-results.json.
- `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/paper-territory/client games/paper-territory/__tests__/artifacts.test.tsx --maxWorkers=1`: **24/24 passed**, 1.87 s after ownership textures and enlarged markers. Fixtures and static HTML come from a real seeded eight-bot match.
- Final `pnpm.cmd typecheck`: passed, exit 0. `pnpm.cmd format`: all matched files use Prettier code style. Earlier checks prompted corrections to client tuple/optional-class typing. Generated contact sheets were formatted last.

## Simulation and properties

The latest CI executed 1,000 seeds at every supported player count, with 600 ms bot decisions and 200 ms physics. Each batch cycles easy/normal/sharp (334/333/333 games). All **7,000 terminated** within the manifest limit of 360,000 ms. This includes the specifically required 2/4/8 batches. The table retains wall-time measurements from expanded CI 38192798653; latest timings and identical game-time outcomes are in latest-scoped-ci.json.

| Players | Games | Median play | Maximum whole game | Wall time |
| ------- | ----- | ----------- | ------------------ | --------- |
| 2       | 1,000 | 120,000 ms  | 131,000 ms         | 5.78 s    |
| 3       | 1,000 | 120,000 ms  | 131,000 ms         | 8.51 s    |
| 4       | 1,000 | 120,000 ms  | 131,000 ms         | 11.45 s   |
| 5       | 1,000 | 120,000 ms  | 131,000 ms         | 14.37 s   |
| 6       | 1,000 | 120,000 ms  | 131,000 ms         | 17.58 s   |
| 7       | 1,000 | 120,000 ms  | 131,000 ms         | 20.51 s   |
| 8       | 1,000 | 120,000 ms  | 131,000 ms         | 23.70 s   |

`tools/latest-scoped-ci.json` records current per-strength area, captures, deaths and growth beyond home at all seven counts. These are same-strength matches and do not establish mixed-match skill ordering. Latest eight-seat sharp median area is 45 cells, median captures 37 and mean deaths 5.827; pre-loop values were 9, 16 and 9.966. Earlier simulation JSON files are historical experiments tied to their recorded source/CI head. An obsolete early 200 ms decision batch was stopped and is not counted: tools/obsolete-batch.md.

Property tests passed seeds 1, 2, 3 plus **1,000 generated seeds** (generator 0x5eed07), 40 mixed events per trace, now sampling every supported count and permanent departures. Checks: JSON/finite/view bounds, spectator identity, permanent-seat invariants, source immutability, deterministic replay, complete results. Seed generator/list: tools/property-results.json; current passed harness and source hash: latest-scoped-ci.json.

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

Latest `node jobs/P07-paper-territory/tools/capture.mjs`: **36 screens** with one isolated cached Chromium, closed in finally. TV 1920 × 1080; phones 390 × 844 with 80 px reserved at both ends for the shell. Every phase covers local/phone-only/remote/spectators; play includes paused/eliminated/permanently departed phones, adjacent heads, home crossings and maximum-area/long-name rows; final screens stress long-name players/spectators. It waits for the correct complete document, fonts and two painted frames before measurements/capture.

Fit report: zero horizontal/vertical overflow, outside elements or internal scrolling. Smallest active touch: **58.65625 px**. Manually inspected three contact sheets: shared map is focal, eight original monochrome ownership textures, persistent homes, readable numbered direction markers, eight-seat standings. TV body 36 px, timer 96 px from tokens. Reduced-motion disables control transitions.

Resumed captures confirmed zero overflow/outside/internal-scroll failures, 58.65625 px minimum active touch, 358 × 256 px final stage maps and 15.108 px head glyphs. Active phone heads are at least 14.72 px; TV heads at least 34.36 px. Manually inspected final long-name screens, adjacent-head/home-crossing stress screens, retired phones and TV/local/stage contact sheets. Latest media: 79 files, 5,612,504 bytes, below 10 MB; SHA256SUMS.txt covers every media file after formatting. Capture accepts PB_CHROME for an existing executable; installs no browser/dependency.

## CI and iteration

.github/workflows/P07.yml uses read-only permissions, Ubuntu, 30-minute timeout, actions/* only and P07 paths. It installs, typechecks, formats and runs only this game. Draft PR leaves draft only after green CI. CI result and post-green audits will be recorded here/LOOP.md.

Initial full CI passed: [run 38177872218](https://github.com/luisitin/partybox-rea-ports/actions/runs/38177872218), 1m30s. PR #4 left draft after this result. R1 targeted command: `pnpm.cmd vitest run games/paper-territory/client/DirectionPad.test.tsx games/paper-territory/client/controls.test.ts games/paper-territory/__tests__/views.test.ts games/paper-territory/__tests__/contract.test.ts --maxWorkers=1`; 3 existing files, 27/27 assertions passed in 4.57 s. The views glob has no separate file; projections are checked by SDK contract and the real-game controller regression.

LOOP.md records every measured iteration. Duplicate local simulation attempts were stopped to preserve desktop CPU; partial logs are explicitly non-final. Earlier failed screenshot timeout and successful 28-screen capture remain historical evidence. Resumed captures include all required/stress variants, and the tool exits only after its finally cleanup has closed the owned browser. CI after R16/rename passed; R17–R19 are three consecutive zero-gain audits with no game-file changes. Convergence is complete; the final documentation head's CI must be green before the claim is DONE.
