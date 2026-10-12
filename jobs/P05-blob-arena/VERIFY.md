# P05 verification

## Current r1-local upgrade

Prior reports below are historical and do not establish the upgraded source. Fresh final typecheck/format/scoped tests, seven1000-match groups,20semantic mutants, every-phase SSR/native captures, original-renderer pairs, media hashes and final-headCI remain pending. Source imports/generation/pushes are prohibited while mutation bugs are planted.

Fresh serial mutations completed: focused baseline91/91 and20/20 semantic assertion kills in134913ms. Every planted byte was restored and independently hash-checked; full restored baseline remains held during the camera integration repair. `mutations.json` explicitly records this incomplete status. No compiler error or timeout counts as a kill.

The first native original comparison matched all three settled cameras, but exposed50/100/150ms temporal errors up to5.957px and0.76313zoom (`r1-fidelity-before-motion.json`). A bounded60Hz camera planner then passed74 focused client checks and `pnpm.cmd typecheck`, but its actual browser integration still failed: sorted SVG groups sampled the newly committed destination as the animation origin, producing23.911px/0.32796 maximum sampled errors (`r1-fidelity-before-integration.json`). Both failed reports retain source guards and finally-closed browsers with zero owned PIDs. No final fidelity pass is claimed. The integration repair must preserve actual120ms body travel/growth through keyed paint-order changes, then independently remeasure camera and body motion.

Focused server repair: `pnpm.cmd vitest run games/agar-io/__tests__/game.test.ts --testNamePattern 'reading floor:|horn boundary:|settles the last physics step' --maxWorkers=1 --pool=threads --reporter=verbose`:21passed,26skipped,586ms, exit0. The earlier horn-only pass was13cases in432ms. These cover leave/kick before/at/after horn, paused active time, once-only totals, full reading deadlines and reconnect/reload boundaries; they are not a full suite or bot proof.

Capture framing is freshly derived from immutable ownerHEAD0a97701d7: ordinary phone header56px plus quiet clock27.6px (VIP60+27.6), no arbitrary80px bottom shell reservation. A naturally wrapping paused banner participates in layout. Quiet-timer TV outer game Stage832.8px and timer-free854.8px are expected; game-specific padding overrides SDK defaults, so inner dimensions must be measured from the actual mounted game. Earlier1728/766.8 inner estimates were SDK defaults, not this game's measured bounds. Owner checkout was read-only.

The original-access attempt itself finished: Chrome1280×800, CloudFront403, no game canvas or controls, no original play/audio claim; finally browserClosedtrue/remainingPids[]. Reference comparison will use unmodified pinned May1renderer with authored packets and no original networking/assets, not claim a current2026 live session.

## Historical r4-local verification

Runner r4-local; official game Agar.io / agar-io; historical job slug P05-blob-arena.

The inherited r5-local head 4f9e6aa passed [CI 38180746625](https://github.com/luisitin/partybox-rea-ports/actions/runs/38180746625). The official-name recovery head 672d748 passed [CI 38209133722](https://github.com/luisitin/partybox-rea-ports/actions/runs/38209133722). These green checks preceded the new lifecycle, fairness and layout fixes. They do not prove the current changes.

The rename pilot used `PB_SIM_RUNS=1 pnpm.cmd vitest run games/agar-io --maxWorkers=1`: 105/105 tests, seven files, seven complete matches, 54.99 s. `pnpm.cmd typecheck` passed. This is a pilot, not the required 7,000-match result.

Current verification is pending source freeze. Required checks: typecheck, whole formatting check, the scoped game tests and real SDK contracts, 1,000 complete matches at every count 2-8, fixed seeds 1/2/3 and 1,000 generated properties, 20 serial semantic mutations, current phase/role/stress captures at 1920x1080 and 390x844 with 80 px shell reservations at both ends, media under 10 MB and every SHA-256 byte match, fresh green PR CI.

Only this game's tests run, with one worker. Full simulations run in scoped CI. The SDK 5,000-event cap, binding three 90-second rounds and existing dependencies are unchanged. No original-site browser is launched. The new capture runner must own one local headless browser and close it in finally.

Historical results remain in the existing raw reports and [r5-history/VERIFY.md](r5-history/VERIFY.md). Old fit used bottom zero and is historical evidence only. Original access attempts and old preview inputs retain their r5-local provenance.

## R1 local source checks

`pnpm.cmd typecheck`: exit 0 after source freeze. `PB_SIM_RUNS=1 PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/agar-io --maxWorkers=1 --reporter=verbose --reporter=json --outputFile=jobs/P05-blob-arena/r4-pilot-tests.json --disableConsoleIntercept`: 153 passed / one failed, 154 total in nine files, 213.23 s. All real SDK contracts, seven one-count pilot matches plus the repeated eight-seat replay, 1,000 world properties and 1,003 lifecycle traces passed. Lifecycle totals: 61,767 events, 50-74 per trace. The failed rendering check caught an empty title caused by multiple JSX title children; its raw result remains retained.

After the single-string title fix, `pnpm.cmd vitest run games/agar-io/__tests__/screens.test.tsx games/agar-io/client --maxWorkers=1 --reporter=json --outputFile=jobs/P05-blob-arena/r4-client-tests.json`: 60/60 passed, exit 0. Fixtures then regenerated from seed 17 using common snapshots and per-seat RNGs; play/score/score-last/done retain a single reducer match. Mutations, captures and fresh full CI remain pending.

`node jobs/P05-blob-arena/mutations.mjs`: exit 0, **20/20 semantic bugs caught by assertion failures**. Baseline 61/61 passed. No compiler/import failure or timeout counts as a catch. All 45 original game files retained their exact bytes after the serial run. `mutations.json` records each planted replacement and failed assertion. `r5-history/mutations.json` preserves the prior runner result.

R1 full scoped [CI 38212411942](https://github.com/luisitin/partybox-rea-ports/actions/runs/38212411942), head `5efddc9b96fa96380b9ff1fb4ea4c634961c316d`: **154/154 tests in nine files, 336.15 s, 7,000 complete matches**, and all 1,003 lifecycle traces. Every one of 45 game-file SHA-256 hashes matches r4-r1-source.json. Each count 2-8 ran 1,000 games (334 easy / 333 normal / 333 sharp), with 90,000 ms median round and 289,500 ms maximum match. Total reducer events: 17983541; maximum in one match: 3404, below the unchanged 5,000-event SDK cap. Exact per-count metrics and lifecycle evidence are in r4-r1-ci-report.json.

Second native capture attempt passed 47 checks, then timed out in Input.dispatchTouchEvent; it is **not** a complete native/fit pass. Browser and owned temporary profile closed/removed, helper closed. The original error is retained separately from a recovered process-inspection timeout. Source review identified an invalid nonempty touchEnd payload under the [primary CDP protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl); this defect is not asserted to cause the earlier phone-only touch-start timeout. Tools are being corrected before another capture.
